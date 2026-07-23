"""虚舟 Haiku Monk — 流浪僧人 | 1.70m 清瘦 东方兜帽"""
import bpy, os
_this_dir = os.path.dirname(bpy.context.space_data.text.filepath)
_utils_dir = os.path.dirname(_this_dir)
exec(open(os.path.join(_utils_dir, 'veilland_utils.py'), encoding='utf-8').read())

generate({
    'id':'HaikuMonk','name':'虚舟','height':1.70,'shape':'slender_male','gender':'male',
    'skin':(0.68,0.60,0.52),'hair_color':(0.04,0.03,0.02),
    'origin':'Eastern','clothing':'robe','weapon':'staff','hair':'hood','extra':None,
})
