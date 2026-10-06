using UnityEngine;

namespace VeilLand.DayVillage
{
    public class VillageDoor : MonoBehaviour
    {
        public string houseName;
        public float interactDistance = 2.2f;
        Transform player;
        Quaternion closedRotation;
        Quaternion openRotation;
        bool isOpen;
        GUIStyle style;

        void Awake()
        {
            closedRotation = transform.localRotation;
            openRotation = closedRotation * Quaternion.Euler(0, -92, 0);
            var found = GameObject.Find("Player_看板娘");
            if (found) player = found.transform;
        }

        void Update()
        {
            if (!player)
            {
                var found = GameObject.Find("Player_看板娘");
                if (found) player = found.transform;
            }
            if (player && Vector3.Distance(player.position, transform.position) <= interactDistance && Input.GetKeyDown(KeyCode.E)) isOpen = !isOpen;
            transform.localRotation = Quaternion.Slerp(transform.localRotation, isOpen ? openRotation : closedRotation, Time.deltaTime * 12f);
        }

        void OnGUI()
        {
            if (!player || Vector3.Distance(player.position, transform.position) > interactDistance) return;
            if (style == null) style = new GUIStyle(GUI.skin.label) { fontSize = 18, alignment = TextAnchor.MiddleCenter };
            GUI.Label(new Rect(Screen.width * .5f - 140, Screen.height - 180, 280, 32), houseName + (isOpen ? "：按 E 关门" : "：按 E 开门"), style);
        }
    }
}
