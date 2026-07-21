"""卡赫特 Anubis Acolyte — 冥界侍僧 | 1.78m 深肤 埃及"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'AnubisAcolyte','name':'卡赫特','height':1.78,'build':'lean','gender':'male',
    'skin':(0.32,0.26,0.20),'hair_color':(0.05,0.04,0.03),
    'origin':'Egyptian','clothing':'tunic','weapon':'spear','hair':'hood','extra':None,
})
