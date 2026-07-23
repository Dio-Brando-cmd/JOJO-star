"""布丽吉德 Brigid — 圣火侍女 | 1.62m 娇小 红发凯尔特"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'veilland_utils.py'), encoding='utf-8').read())

generate({
    'id':'Brigid','name':'布丽吉德','height':1.62,'shape':'slender_female','gender':'female',
    'skin':(0.73,0.66,0.60),'hair_color':(0.78,0.32,0.12),
    'origin':'Celtic','clothing':'robe','weapon':'staff','hair':'long','extra':'crown',
})
