"""赫克托 Hector — 特洛伊之盾 | 1.88m 希腊重装"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'Hector','name':'赫克托','height':1.88,'build':'muscular','gender':'male',
    'skin':(0.60,0.52,0.42),'hair_color':(0.10,0.08,0.06),
    'origin':'Greek','clothing':'armor','weapon':'spear','hair':'helmet','extra':'shield',
})
