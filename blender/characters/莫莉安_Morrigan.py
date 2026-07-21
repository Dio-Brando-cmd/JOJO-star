"""莫莉安 Morrigan — 最后的德鲁伊 | 1.67m 黑发披风"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'Morrigan','name':'莫莉安','height':1.67,'build':'lean','gender':'female',
    'skin':(0.70,0.62,0.55),'hair_color':(0.12,0.10,0.08),
    'origin':'Celtic','clothing':'robe','weapon':'staff','hair':'long','extra':'cape',
})
