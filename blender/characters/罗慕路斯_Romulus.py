"""罗慕路斯 Romulus — 狼养之子 | 1.82m 罗马盔甲"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'Romulus','name':'罗慕路斯','height':1.82,'build':'muscular','gender':'male',
    'skin':(0.62,0.54,0.44),'hair_color':(0.08,0.06,0.05),
    'origin':'Roman','clothing':'armor','weapon':'sword','hair':'helmet','extra':'cape',
})
