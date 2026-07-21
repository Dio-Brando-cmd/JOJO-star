"""西格德 Sigurd — 维京老战士 | 1.91m 肌肉型"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'Sigurd','name':'西格德','height':1.91,'build':'muscular','gender':'male',
    'skin':(0.65,0.55,0.45),'hair_color':(0.42,0.32,0.22),
    'origin':'Norse','clothing':'armor','weapon':'sword','hair':'long','extra':'beard',
})
