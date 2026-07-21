"""虚舟 Haiku Monk — 流浪僧人 | 1.70m 东方兜帽"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'HaikuMonk','name':'虚舟','height':1.70,'build':'lean','gender':'male',
    'skin':(0.68,0.60,0.52),'hair_color':(0.04,0.03,0.02),
    'origin':'Eastern','clothing':'robe','weapon':'staff','hair':'hood','extra':None,
})
