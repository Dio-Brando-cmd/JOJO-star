// ============================================================
// SocketIODTO.cs — 镜像服务端 JSON 的数据对象 (字段名严格 camelCase)
//
// 说明:
//   - 服务端 socket.io 用 JSON.stringify, undefined 字段会被省略。
//     Newtonsoft 反序列化时缺失字段保持 null/默认值, 无副作用。
//   - PlayerState / GameState / PrivateState / CharacterSelectData
//     原在 NetworkManager.cs 中, 迁到此文件并扩展以对齐服务端字段。
// ============================================================

using System.Collections.Generic;

// ---- 公开玩家信息 (game:state.players[] / 3dNightStart.players[]) ----
[System.Serializable]
public class PlayerState
{
    public string id;
    public string name;
    public bool alive;
    public bool isBot;
    public string characterId;
    public string role;
    public string team;

    // 桌游夜晚状态
    public bool heavyInjury;
    public bool isProtecting;
    public int weaverIndex;
    public string weaverName;
    public string weaverType;

    // 3D 位置 (旧桩字段, 实际位置走 players:positions)
    public float posX, posY, posZ;
    public float rotY;
    public bool isMoving;
    public bool isSprinting;
}

// ---- 公开游戏状态 (game:state) ----
[System.Serializable]
public class GameState
{
    public string id;
    public string hostId;
    public string phase;
    public string gameMode;
    public int round;
    public string nightStep;
    public int timeLeft;                 // 旧桩字段 (phaseChange 里才有真实倒计时)
    public bool isPrivate;
    public int maxPlayers;

    public PlayerState[] players;
    public Dictionary<string, string> votes;
    public VoteResultsDTO voteResults;

    public object nightLog;
    public object nightNarrative;
    public object dayLog;

    public float discussionTimeLeft;
    public string currentSpeakerId;
    public object characterSelect;
}

// ---- 私有玩家状态 (myPrivateState = Player.toPrivateJSON()) ----
[System.Serializable]
public class PrivatePlayerStateDTO
{
    public string id, name, role, team, characterId;
    public bool alive, heavyInjury, isProtecting;
    public bool hasRifle, hasBlunderbuss, rifleUsable, blunderbussUsable;
    public bool isTransformed, hasUsedCorrupt, willBecomeCorrupted, corruptedByNetherMonk;
    public bool isHidden, isInCombat;
    public float stamina;
    public string weaverName, weaverType, weaverTitle;
    public bool hasHealTalisman, hasSealTalisman;
    public int talismanMaterials;
    public object knownCorrupted;
    public object characterTraits;
    public object traitCooldowns;
}

// ---- 私有游戏状态 (game:privateState = publicState + 私有字段) ----
[System.Serializable]
public class PrivateState : GameState
{
    public string myRole;
    public string myTeam;
    public string characterId;
    public PrivatePlayerStateDTO myPrivateState;
    public object privateLog;
    public Dictionary<string, string> seerCheckResults;
}

// ---- 选角数据 ----
[System.Serializable]
public class CharacterSelectData
{
    public string[] availableCharacters;
    public int timeLeft;
}

// ============================================================
// 3D 追逃专用 DTO
// ============================================================

// players:positions 单项
[System.Serializable]
public class PositionDTO
{
    public float x, y, z;
    public float rotY;
    public bool isMoving;
    public bool isSprinting;
    public long timestamp;
}

// players:positions 广播
[System.Serializable]
public class PositionBroadcastDTO
{
    public Dictionary<string, PositionDTO> positions;
    public long timestamp;
}

// game:3dNightStart
[System.Serializable]
public class NightStartDTO
{
    public float timeLeft;
    public string nightStep;
    public PlayerState[] players;
}

// 3d:attack 应答
[System.Serializable]
public class AttackResultDTO
{
    public bool success;
    public string result;   // KILLED / ESCAPED / COUNTERED
    public string victim;
    public string killer;
    public string reason;   // COOLDOWN 等
    public string error;
}

// game:phaseChange
[System.Serializable]
public class PhaseChangeDTO
{
    public string phase;
    public int round;
    public string nightStep;
    public float timeLeft;
    public float discussionTimeLeft;
    public string currentSpeakerId;
}

// game:voteResults
[System.Serializable]
public class VoteResultsDTO
{
    public string eliminated;
    public Dictionary<string, string> votes;
    public bool tie;
    public int totalVotes;
    public string reason;
}

// game:over
[System.Serializable]
public class GameOverDTO
{
    public string winner;
    public string reason;
    public object ending;
    public PlayerState[] players;
}

// chat:message
[System.Serializable]
public class ChatMessageDTO
{
    public string playerId;
    public string playerName;
    public string message;
    public long timestamp;
}

// ---- 灵焰仪式 (game:flameUpdate) ----

// 灵焰地标
[System.Serializable]
public class FlameDTO
{
    public string id;
    public string name;
    public float x, z;
    public bool collected;
}

// 仪式引导状态
[System.Serializable]
public class RitualDTO
{
    public string playerId;
    public long startedAt;
    public int duration;
}

// game:flameUpdate 广播 (采集数 + 地标 + 仪式)
[System.Serializable]
public class FlameUpdateDTO
{
    public FlameDTO[] flames;
    public int collected;
    public int total;
    public RitualDTO ritual;
}
