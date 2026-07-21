"""西格德 Sigurd — 维京老战士 | 1.91m 肌肉型"""
import bpy, os

# 找到 werewolf_utils.py（在 characters 目录的上一级）
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'Sigurd','name':'西格德','height':1.91,'build':'muscular','gender':'male',
    'skin':(0.65,0.55,0.45),'hair_color':(0.42,0.32,0.22),
    'origin':'Norse','clothing':'armor','weapon':'sword','hair':'long','extra':'beard',
})
