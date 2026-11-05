"""Incremental Windows storage. Originals are immutable; SQLite contains only references."""
from contextlib import contextmanager
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import time
from PIL import Image, ImageOps

MEDIA = re.compile(r"^/api/media/([a-f0-9]{64})$")
FORMATS = {'PNG': ('png','image/png'), 'JPEG': ('jpg','image/jpeg'), 'WEBP': ('webp','image/webp'), 'GIF': ('gif','image/gif')}
MAX_IMAGE = 16 * 1024 * 1024


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def image_file(folder, digest):
    for ext, mime in FORMATS.values():
        path = folder / 'images' / f'{digest}.{ext}'
        if path.is_file():
            return path, mime
    raise ValueError('An original image is missing. Restore it from your export or backup.')


def store_image(folder, data):
    if not data or len(data) > MAX_IMAGE:
        raise ValueError('Choose an image smaller than 16 MB.')
    digest = hashlib.sha256(data).hexdigest()
    thumb = folder / 'thumbnails' / f'{digest}.webp'
    if thumb.is_file():
        try:
            image_file(folder, digest)
            return '/api/media/' + digest
        except ValueError:
            pass
    with Image.open(io.BytesIO(data)) as original:
        if original.format not in FORMATS or original.width * original.height > 40_000_000:
            raise ValueError('Use PNG, JPEG, WebP or GIF, at most 40 megapixels.')
        ext, _ = FORMATS[original.format]
        original.thumbnail((480, 480), Image.Resampling.LANCZOS)
        preview = ImageOps.exif_transpose(original).convert('RGBA')
        output = io.BytesIO()
        preview.save(output, format='WEBP', quality=80, method=4)
    atomic(folder / 'images' / f'{digest}.{ext}', data)
    atomic(thumb, output.getvalue())
    return '/api/media/' + digest


def externalize(folder, library):
    """Convert legacy embedded images without changing the legacy backup."""
    cache = {}
    def visit(value):
        if isinstance(value, dict):
            for key, item in list(value.items()):
                if key in ('termImage','definitionImage','promptImage','answerImage') and item:
                    if isinstance(item, dict) and set(item) == {'mediaId'}:
                        item = library.get('media', {}).get(item['mediaId'])
                    if isinstance(item,str) and MEDIA.fullmatch(item):
                        value[key]=item
                        continue
                    if not isinstance(item, str) or not item.startswith('data:image/'):
                        raise ValueError('Invalid legacy image. The original library has been preserved.')
                    if item not in cache:
                        cache[item] = store_image(folder, base64.b64decode(item.split(',',1)[1], validate=True))
                    value[key] = cache[item]
                else:
                    visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)
    visit(library)
    library.pop('media', None)
    library['version'] = 1
    return library


def key(*parts):
    return json.dumps(parts, separators=(',',':'), ensure_ascii=False)


def flatten(library):
    records = {}
    def deck(kind, ident, value):
        meta = dict(value)
        cards = meta.pop('cards')
        records[key(kind, ident)] = {'meta':meta, 'cards':[c['id'] for c in cards]}
        for card in cards:
            records[key(kind+'Card', ident, card['id'])] = card
    root = dict(library)
    decks = root.pop('decks', [])
    drafts = root.pop('editorDrafts', [])
    root['decks'] = [d['id'] for d in decks]
    root['editorDrafts'] = [d['id'] for d in drafts]
    records[key('root')] = root
    for d in decks:
        deck('deck',d['id'],d)
    for d in drafts:
        meta = dict(d)
        deck('draftDeck',d['id'],meta.pop('deck'))
        records[key('draft',d['id'])] = meta
    return records


def assemble(records):
    if key('root') not in records:
        return None
    root = dict(records[key('root')])
    def deck(kind, ident):
        record = records[key(kind,ident)]
        return {**record['meta'], 'cards':[records[key(kind+'Card',ident,c)] for c in record['cards']]}
    root['decks'] = [deck('deck',d) for d in root['decks']]
    root['editorDrafts'] = [{**records[key('draft',d)], 'deck':deck('draftDeck',d)} for d in root['editorDrafts']]
    return root


def check_library(folder, value):
    if not isinstance(value,dict) or value.get('version') != 1 or not isinstance(value.get('decks'),list):
        raise ValueError('Invalid library.')
    ids = set()
    for deck in value['decks']:
        if not isinstance(deck.get('id'),str) or deck['id'] in ids or not isinstance(deck.get('cards'),list):
            raise ValueError('Invalid or duplicate deck.')
        ids.add(deck['id'])
        card_ids = set()
        for card in deck['cards']:
            if not isinstance(card.get('id'),str) or card['id'] in card_ids or not isinstance(card.get('term'),str) or not isinstance(card.get('definition'),str):
                raise ValueError('Invalid or duplicate card.')
            card_ids.add(card['id'])
    checked = set()
    def visit(obj):
        if isinstance(obj,dict):
            for field, item in obj.items():
                if field in ('termImage','definitionImage','promptImage','answerImage') and item:
                    match = MEDIA.fullmatch(item) if isinstance(item,str) else None
                    if not match:
                        raise ValueError('Images must be stored before saving their references.')
                    if match[1] in checked:
                        continue
                    checked.add(match[1])
                    image_file(folder,match[1])
                    if not (folder/'thumbnails'/f'{match[1]}.webp').is_file():
                        raise ValueError('Image thumbnail is missing.')
                else:
                    visit(item)
        elif isinstance(obj,list):
            for item in obj:
                visit(item)
    visit(value)


class IncrementalStore:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.folder.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.folder/'library.sqlite3', timeout=30)
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA synchronous=FULL')
        db.executescript('CREATE TABLE IF NOT EXISTS records(k TEXT PRIMARY KEY,v TEXT NOT NULL); CREATE TABLE IF NOT EXISTS previous_records(k TEXT PRIMARY KEY,v TEXT NOT NULL); CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL); INSERT OR IGNORE INTO state VALUES(1,0); CREATE TABLE IF NOT EXISTS save_receipts(id TEXT PRIMARY KEY,digest TEXT NOT NULL,revision INTEGER NOT NULL);')
        try:
            with db:
                yield db
        finally:
            db.close()

    def load(self, legacy=None):
        with self.connect() as db:
            if db.execute('SELECT revision FROM state').fetchone()[0] == 0 and legacy is not None:
                if legacy.get('version') not in (1,2) or any(d.get('deckFormatVersion',1)>1 for d in legacy.get('decks',[])):
                    raise ValueError('This library needs a newer version. The original has not been changed.')
                library = externalize(self.folder,legacy)
                check_library(self.folder,library)
                records = flatten(library)
                db.executemany('INSERT INTO records VALUES(?,?)',[(k,json.dumps(v,ensure_ascii=False,separators=(',',':'))) for k,v in records.items()])
                db.execute('UPDATE state SET revision=1')
            rows = dict((k,json.loads(v)) for k,v in db.execute('SELECT k,v FROM records'))
            return assemble(rows), str(db.execute('SELECT revision FROM state').fetchone()[0])

    def patch(self, patch, expected):
        if not isinstance(patch,dict) or not {'set','remove'} <= set(patch) or not set(patch) <= {'set','remove','requestId'} or not isinstance(patch['set'],list) or not isinstance(patch['remove'],list):
            raise ValueError('Invalid changes.')
        request_id=patch.get('requestId')
        if request_id is not None and (not isinstance(request_id,str) or not re.fullmatch(r'[A-Za-z0-9-]{16,128}',request_id)):
            raise ValueError('Invalid save request ID.')
        digest=hashlib.sha256(json.dumps({'set':patch['set'],'remove':patch['remove']},sort_keys=True,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode('utf-8')).hexdigest()
        with self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            if request_id is not None:
                receipt=db.execute('SELECT digest,revision FROM save_receipts WHERE id=?',(request_id,)).fetchone()
                if receipt:
                    if receipt[0]!=digest:raise ValueError('Save request ID was reused with different changes.')
                    return str(receipt[1])
            rev = db.execute('SELECT revision FROM state').fetchone()[0]
            if str(rev) != expected:
                raise FileExistsError('This library changed in another window. Export your edits before reloading.')
            records = {k:json.loads(v) for k,v in db.execute('SELECT k,v FROM records')}
            for k in patch['remove']:
                if not isinstance(k,str):
                    raise ValueError('Invalid record key.')
                records.pop(k,None)
            for k,v in patch['set']:
                if not isinstance(k,str) or len(k)>2000:
                    raise ValueError('Invalid record key.')
                records[k] = v
            try:
                value = assemble(records)
                check_library(self.folder,value)
                if set(flatten(value)) != set(records):
                    raise ValueError('Unreferenced records in changes.')
            except (KeyError,TypeError,AttributeError) as exc:
                raise ValueError('Incomplete library changes.') from exc
            if patch['set'] or patch['remove']:
                db.execute('DELETE FROM previous_records')
                db.execute('INSERT INTO previous_records SELECT * FROM records')
                db.executemany('DELETE FROM records WHERE k=?',[(k,) for k in patch['remove']])
                db.executemany('INSERT OR REPLACE INTO records VALUES(?,?)',[(k,json.dumps(v,ensure_ascii=False,allow_nan=False,separators=(',',':'))) for k,v in patch['set']])
                rev += 1
                db.execute('UPDATE state SET revision=?',(rev,))
            if request_id is not None:
                db.execute('INSERT INTO save_receipts VALUES(?,?,?)',(request_id,digest,rev))
                db.execute('DELETE FROM save_receipts WHERE rowid NOT IN (SELECT rowid FROM save_receipts ORDER BY rowid DESC LIMIT 4096)')
            return str(rev)

    def collect(self, now=None):
        """Keep current/previous snapshots and a seven-day grace period for pending uploads."""
        now = time.time() if now is None else now
        with self.connect() as db:
            # Serialize cleanup with writers; callers serialize uploads with the same app lock.
            db.execute('BEGIN IMMEDIATE')
            used = set()
            for (text,) in db.execute('SELECT v FROM records UNION ALL SELECT v FROM previous_records'):
                used.update(re.findall(r'/api/media/([a-f0-9]{64})',text))
            for directory in ('images','thumbnails'):
                for path in (self.folder/directory).glob('*'):
                    if path.stem not in used and now-path.stat().st_mtime > 7*86400:
                        path.unlink()
