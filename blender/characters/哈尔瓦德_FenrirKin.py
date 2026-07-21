"""哈尔瓦德 Fenrir Kin — 魔狼血裔 | 1.95m 魁梧巨斧"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'FenrirKin','name':'哈尔瓦德','height':1.95,'build':'heavy','gender':'male',
    'skin':(0.55,0.48,0.40),'hair_color':(0.28,0.23,0.15),
    'origin':'Norse','clothing':'tunic','weapon':'axe','hair':'long','extra':'beard',
})
