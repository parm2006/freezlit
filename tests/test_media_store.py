from contextlib import closing
import base64
import copy
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest
from PIL import Image
from media_store import IncrementalStore, store_image, image_file, flatten, assemble, key


def png(size=(1600,1000)):
    out=io.BytesIO()
    Image.new('RGB',size,'#276349').save(out,format='PNG')
    return out.getvalue()


def library(image=''):
    return {'version':1,'decks':[{'id':'d','title':'Japanese Periods','cards':[{'id':'c','term':'Kofun','definition':'','termImage':image}]}], 'editorDrafts':[], 'history':[], 'records':{}, 'settings':{}}


class ImageStoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.folder=Path(self.tmp.name)
        self.store=IncrementalStore(self.folder)
    def tearDown(self):
        self.tmp.cleanup()
    def patch(self,old,new,rev):
        a,b=flatten(old),flatten(new)
        return self.store.patch({'set':[[k,v] for k,v in b.items() if a.get(k)!=v], 'remove':[k for k in a if k not in b]},rev)
    def test_original_dedup_and_compressed_thumbnail(self):
        raw=png();ref=store_image(self.folder,raw)
        self.assertEqual(ref,store_image(self.folder,raw))
        self.assertEqual(len(list((self.folder/'images').iterdir())),1)
        self.assertEqual(image_file(self.folder,ref.rsplit('/',1)[1])[0].read_bytes(),raw)
        with Image.open(self.folder/'thumbnails'/f'{ref.rsplit("/",1)[1]}.webp') as image:
            self.assertLessEqual(max(image.size),480)
            self.assertEqual(image.format,'WEBP')
    def test_migration_preserves_json_and_extracts_draft_and_test_images(self):
        value=library('data:image/png;base64,'+base64.b64encode(png()).decode())
        value['editorDrafts']=[{'id':'draft','deckId':'d','deck':copy.deepcopy(value['decks'][0])}]
        value['testDrafts']={'d':{'questions':[{'promptImage':value['decks'][0]['cards'][0]['termImage']}]}}
        original=json.dumps(value).encode();(self.folder/'library.json').write_bytes(original)
        result,rev=self.store.load(copy.deepcopy(value))
        self.assertEqual(rev,'1');self.assertEqual((self.folder/'library.json').read_bytes(),original)
        self.assertNotIn('base64',json.dumps(result));self.assertEqual(len(list((self.folder/'images').iterdir())),1)
        result['editorDrafts'][0]['deck']['cards'][0]['term']='Unsaved draft'
        self.patch(self.store.load()[0],result,rev)
        self.assertEqual(self.store.load()[0]['editorDrafts'][0]['deck']['cards'][0]['term'],'Unsaved draft')
    def test_v2_migration_and_failed_migration_are_safe(self):
        value=library({'mediaId':'m0'});value['version']=2
        value['media']={'m0':'data:image/png;base64,'+base64.b64encode(png()).decode()}
        result,rev=self.store.load(value);self.assertEqual(result['version'],1)
        bad=IncrementalStore(self.folder/'bad')
        with self.assertRaises((ValueError,OSError)):
            bad.load(library('data:image/png;base64,AAAA'))
        self.assertEqual(bad.load(),(None,'0'))
    def test_only_changed_card_written_and_stale_writer_rejected(self):
        before,rev=self.store.load(library());after=copy.deepcopy(before);after['decks'][0]['cards'][0]['term']='Edited'
        revision=self.patch(before,after,rev)
        with closing(sqlite3.connect(self.folder/'library.sqlite3')) as db:
            previous=dict(db.execute('SELECT k,v FROM previous_records'))
            current=dict(db.execute('SELECT k,v FROM records'))
        self.assertEqual([k for k in current if current[k]!=previous[k]],[key('deckCard','d','c')])
        with self.assertRaises(FileExistsError):self.patch(before,after,rev)
        self.assertEqual(self.store.load()[1],revision)
        self.assertEqual(self.store.patch({'set':[],'remove':[]},revision),revision)
    def test_missing_reference_rejected_without_losing_committed_data(self):
        before,rev=self.store.load(library());after=copy.deepcopy(before)
        after['decks'][0]['cards'][0]['termImage']='/api/media/'+'a'*64
        with self.assertRaises(ValueError):self.patch(before,after,rev)
        self.assertEqual(self.store.load(),(before,rev))
    def test_cleanup_retains_drafts_previous_and_recent_uploads(self):
        ref=store_image(self.folder,png());before=library()
        before['editorDrafts']=[{'id':'draft','deck':{'id':'d','cards':[{'id':'c','term':'','definition':'','termImage':ref}]}}]
        before,rev=self.store.load(before)
        after=copy.deepcopy(before);after['editorDrafts']=[];rev=self.patch(before,after,rev)
        self.store.collect(now=time.time()+8*86400)
        self.assertTrue(image_file(self.folder,ref.rsplit('/',1)[1])[0].exists())
        newer=copy.deepcopy(after);newer['decks'][0]['title']='Next save';self.patch(after,newer,rev)
        self.store.collect() # recent upload grace
        self.assertTrue(image_file(self.folder,ref.rsplit('/',1)[1])[0].exists())
        self.store.collect(now=time.time()+8*86400)
        with self.assertRaises(ValueError):image_file(self.folder,ref.rsplit('/',1)[1])
    def test_invalid_upload_and_future_format_do_not_initialize_library(self):
        for bad in (b'not an image',b''):
            with self.assertRaises((OSError,ValueError)):store_image(self.folder,bad)
        future=library();future['version']=3
        with self.assertRaises(ValueError):self.store.load(future)
        self.assertEqual(self.store.load(),(None,'0'))

if __name__=='__main__':unittest.main()
