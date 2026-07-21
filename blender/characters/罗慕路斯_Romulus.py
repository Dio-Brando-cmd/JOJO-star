"""罗慕路斯 Romulus — 狼养之子 | 1.82m 罗马盔甲"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'werewolf_utils.py'), encoding='utf-8').read())

generate({
    'id':'Romulus','name':'罗慕路斯','height':1.82,'build':'muscular','gender':'male',
    'skin':(0.62,0.54,0.44),'hair_color':(0.08,0.06,0.05),
    'origin':'Roman','clothing':'armor','weapon':'sword','hair':'helmet','extra':'cape',
})
