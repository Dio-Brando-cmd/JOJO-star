"""斯卡蒂 Skadi — 雪山猎手 | 1.91m 银发女猎手"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'Skadi','name':'斯卡蒂','height':1.91,'build':'lean','gender':'female',
    'skin':(0.72,0.64,0.58),'hair_color':(0.82,0.80,0.76),
    'origin':'Norse','clothing':'tunic','weapon':'bow','hair':'long','extra':'cape',
})
