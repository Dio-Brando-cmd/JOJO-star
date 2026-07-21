"""布丽吉德 Brigid — 圣火侍女 | 1.62m 红发凯尔特"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'Brigid','name':'布丽吉德','height':1.62,'build':'lean','gender':'female',
    'skin':(0.73,0.66,0.60),'hair_color':(0.78,0.32,0.12),
    'origin':'Celtic','clothing':'robe','weapon':'staff','hair':'long','extra':'crown',
})
