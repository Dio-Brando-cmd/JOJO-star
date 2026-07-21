"""莫莉安 Morrigan — 最后的德鲁伊 | 1.67m 窈窕 黑发披风"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'Morrigan','name':'莫莉安','height':1.67,'shape':'slender_female','gender':'female',
    'skin':(0.70,0.62,0.55),'hair_color':(0.12,0.10,0.08),
    'origin':'Celtic','clothing':'robe','weapon':'staff','hair':'long','extra':'cape',
})
