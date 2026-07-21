"""卡赫特 Anubis Acolyte — 冥界侍僧 | 1.78m 深肤 埃及"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'AnubisAcolyte','name':'卡赫特','height':1.78,'build':'lean','gender':'male',
    'skin':(0.32,0.26,0.20),'hair_color':(0.05,0.04,0.03),
    'origin':'Egyptian','clothing':'tunic','weapon':'spear','hair':'hood','extra':None,
})
