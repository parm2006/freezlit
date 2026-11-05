"""Smoke-test a packaged binary under build/ against synthetic, isolated data only."""
import argparse
import hashlib
import http.client
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import time

root=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser()
parser.add_argument('--exe',type=Path,default=root/'build/clone-dist/FreezlitClone.exe')
exe=parser.parse_args().exe.resolve()
assert exe.name in ('FreezlitClone.exe','Freezlit.exe') and exe.is_relative_to(root/'build')
folder=root/'build/packaged-qa-data'
folder.mkdir(parents=True,exist_ok=True)
legacy=(root/'build/qa-data/library.json').read_bytes()
(folder/'library.json').write_bytes(legacy)
for name in ('library.sqlite3','library.sqlite3-wal','library.sqlite3-shm'):
    (folder/name).unlink(missing_ok=True)

def start():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
    env={**os.environ,'FREEZLIT_CLONE_DATA_DIR':str(folder),'FREEZLIT_DATA_DIR':str(folder)}
    process=subprocess.Popen([str(exe),'--no-browser','--port',str(port)],env=env,creationflags=subprocess.CREATE_NO_WINDOW)
    def request(method,path,body=None,headers=None):
        connection=http.client.HTTPConnection('127.0.0.1',port,timeout=10)
        values={'Origin':f'http://127.0.0.1:{port}',**(headers or {})}
        connection.request(method,path,body,values);response=connection.getresponse()
        result=(response.status,dict(response.getheaders()),response.read());connection.close();return result
    for _ in range(200):
        if process.poll() is not None:raise RuntimeError('Clone exited before startup')
        try:
            status,headers,body=request('GET','/api/state')
            if status==200:return process,request,json.loads(body),headers['ETag']
        except OSError:pass
        time.sleep(.1)
    process.terminate();process.wait();raise RuntimeError('Clone startup timed out')

process,request,value,rev=start()
try:
    assert value['decks'][0]['title']=='Japanese Periods (isolated fixture)'
    assert len(value['decks'][0]['cards'])==60
    card=dict(value['decks'][0]['cards'][0]);original=card['termImage'];card['term']='Saved through packaged clone'
    status,_,full=request('GET',original);assert status==200
    status,_,thumb=request('GET',original.replace('/media/','/thumb/'));assert status==200 and thumb[:4]==b'RIFF'
    assert hashlib.sha256(full).hexdigest()==original.rsplit('/',1)[1]
    key=json.dumps(['deckCard','japan',card['id']],separators=(',',':'))
    patch=json.dumps({'set':[[key,card]],'remove':[]}).encode()
    status,_,_=request('PUT','/api/state',patch,{'If-Match':rev,'Content-Type':'application/json'});assert status==200
    status,_,app=request('GET','/app.js');assert status==200 and app==(root/'web/app.js').read_bytes()
    assert (folder/'library.json').read_bytes()==legacy
finally:
    subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],check=True,stdout=subprocess.DEVNULL);process.wait(timeout=15)
process,request,value,rev=start()
try:
    assert value['decks'][0]['cards'][0]['term']=='Saved through packaged clone'
finally:
    subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],check=True,stdout=subprocess.DEVNULL);process.wait(timeout=15)
report={'passed':True,'binary':exe.name,'packagedAssetsMatchSource':True,'migrationPreservedLegacy':True,'originalSHA256Verified':True,'thumbnailWebP':True,'incrementalSaveBytes':len(patch),'restartPreservedEdits':True}
(root/'build/qa-results').mkdir(parents=True,exist_ok=True)
(root/'build/qa-results/packaged-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
