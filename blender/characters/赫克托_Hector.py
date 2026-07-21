"""赫克托 Hector — 特洛伊之盾 | 1.88m 希腊重装"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'Hector','name':'赫克托','height':1.88,'build':'muscular','gender':'male',
    'skin':(0.60,0.52,0.42),'hair_color':(0.10,0.08,0.06),
    'origin':'Greek','clothing':'armor','weapon':'spear','hair':'helmet','extra':'shield',
})
