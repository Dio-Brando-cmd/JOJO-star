"""芙蕾雅 Freyja — 华纳末裔 | 1.64m 娇小金发女神"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'Freyja','name':'芙蕾雅','height':1.64,'shape':'petite_female','gender':'female',
    'skin':(0.75,0.65,0.58),'hair_color':(0.85,0.78,0.55),
    'origin':'Norse','clothing':'robe','weapon':'staff','hair':'long','extra':'crown',
})
