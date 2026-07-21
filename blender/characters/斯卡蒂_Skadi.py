"""斯卡蒂 Skadi — 雪山猎手 | 1.91m 银发女猎手"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'Skadi','name':'斯卡蒂','height':1.91,'build':'lean','gender':'female',
    'skin':(0.72,0.64,0.58),'hair_color':(0.82,0.80,0.76),
    'origin':'Norse','clothing':'tunic','weapon':'bow','hair':'long','extra':'cape',
})
