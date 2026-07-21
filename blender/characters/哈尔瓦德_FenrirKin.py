"""哈尔瓦德 Fenrir Kin — 魔狼血裔 | 1.95m 魁梧巨斧"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from werewolf_utils import *

generate({
    'id':'FenrirKin','name':'哈尔瓦德','height':1.95,'build':'heavy','gender':'male',
    'skin':(0.55,0.48,0.40),'hair_color':(0.28,0.23,0.15),
    'origin':'Norse','clothing':'tunic','weapon':'axe','hair':'long','extra':'beard',
})
