"""Create only the synthetic fixture used by the isolated UI regression test."""
from pathlib import Path
import base64,io,json
from PIL import Image,ImageDraw
folder=Path('build/qa-data');folder.mkdir(parents=True,exist_ok=True)
images=[]
for n in range(5):
    image=Image.new('RGB',(2000,1200),'#f6f5ef');draw=ImageDraw.Draw(image)
    draw.text((100,100),'Japanese Periods - screenshot fixture '+str(n),fill='#243c33',font_size=44)
    for y in range(200,1100,60):
        draw.text((100,y),'Timeline, key terms and study notes. Original resolution preserved.',fill='#236349',font_size=30)
    stream=io.BytesIO();image.save(stream,format='PNG')
    images.append('data:image/png;base64,'+base64.b64encode(stream.getvalue()).decode())
cards=[{'id':f'card-{i}','term':f'Period {i}','definition':'Timeline and context','termImage':images[i%5],'definitionImage':'','tags':[],'notes':'','additionalInfo':'','schedule':{}} for i in range(60)]
library={'version':1,'decks':[{'id':'japan','title':'Japanese Periods (isolated fixture)','description':'Synthetic screenshots; no production data','cards':cards},{'id':'other','title':'Other deck','cards':[{'id':'other-card','term':'Other','definition':'Deck'}]}],'settings':{'newLimit':20,'reviewLimit':200},'history':[],'records':{},'editorDrafts':[]}
(folder/'library.json').write_text(json.dumps(library),encoding='utf-8')
(folder/'upload.png').write_bytes(base64.b64decode(images[0].split(',')[1]))
