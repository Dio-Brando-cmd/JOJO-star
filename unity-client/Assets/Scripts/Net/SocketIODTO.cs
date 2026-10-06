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
    public int round;
    public int maxRounds;
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

// ============================================================
// 真相盘 (TRUTH_DISC) DTO —— 镜像服务端 TruthGame 公开/私有状态
// ============================================================

// 命运时钟 (公开: truth:state.clocks)
[System.Serializable]
public class TruthClocksDTO
{
    public int spirit;    // 灵焰 0..(spiritMax+extra)
    public int despair;   // 绝望 0..despairMax
    public int veil;      // 帷幕吞噬度 0..veilConsumeMax
}

// 区域 (公开: truth:state.zones[])
[System.Serializable]
public class TruthZoneDTO
{
    public string name;
    public bool consumed;
}

// 净化点 (公开: truth:state.purifyPoint) —— zone 为 null 表示灰烬之神隐藏净化点
[System.Serializable]
public class TruthPurifyPointDTO
{
    public string zone;
}

// 任务 (公开: truth:state.tasks[])
[System.Serializable]
public class TruthTaskDTO
{
    public string id;
    public string name;
    public bool completed;
    public string completedBy;
    public bool sabotaged;
}

// 玩家 (公开: truth:state.players[]) —— id 为座次 P1..Pn; socketId 供位置映射
[System.Serializable]
public class TruthPlayerDTO
{
    public string id;
    public string socketId;
    public string name;
    public bool alive;
    public string zone;
    public string role;   // 仅终局公开
    public string team;   // 仅终局公开
}

// 阶段解锁 (公开: truth:state.unlocks)
[System.Serializable]
public class TruthUnlocksDTO
{
    public bool veilKeeperArmed;   // 守幕者短铳 (阶段2+)
    public bool spiritCanBurnVeil; // 灵焰烧帷幕 (阶段3+)
}

// 公开规则常量 (公开: truth:state.rules)
[System.Serializable]
public class TruthRulesDTO
{
    public int spiritMax;
    public int despairMax;
    public int phase2Despair;
    public int phase3Despair;
    public int veilConsumeMax;
    public int veilConsumeIntervalSec;
    public int corruptedCount;
    public int playerCount;
}

// 神 (公开终局: truth:state.god / 私有碎片 hintGod / truth:ended.god)
[System.Serializable]
public class TruthGodDTO
{
    public string id;
    public string name;
    public string icon;
}

// 神引用 (私有: reincarnationOf)
[System.Serializable]
public class TruthGodRefDTO
{
    public string id;
    public string name;
}

// 座次引用 (私有: guardTarget / fellowCorrupted[])
[System.Serializable]
public class TruthSeatRefDTO
{
    public string seat;
    public string name;
}

// 碎片 (私有: myShards[]) —— 不下发 kind(真/伪)，玩家自行判断
[System.Serializable]
public class TruthShardDTO
{
    public string id;
    public string text;
    public TruthGodDTO hintGod;
}

// 契约 (私有: myContract)
[System.Serializable]
public class TruthContractDTO
{
    public string id;
    public string name;
    public string icon;
    public string desc;
    public int points;
}

// 个人计分 (终局: truth:state.scores[] / truth:ended.scores[])
[System.Serializable]
public class TruthScoreDTO
{
    public string playerId;
    public string name;
    public string team;
    public string role;
    public string contract;
    public int points;
    public string[] why;
}

// 公开状态 (truth:state)
[System.Serializable]
public class TruthStateDTO
{
    public string id;
    public string hostId;
    public string phase;        // LOBBY / PLAYING / GAME_OVER
    public string gameMode;
    public int maxPlayers;
    public int minPlayers;

    public TruthClocksDTO clocks;
    public int enginePhase;     // 命运时钟阶段 1/2/3
    public TruthUnlocksDTO unlocks;
    public bool ebbWindow;      // 潮汐之神退潮窗口

    public TruthZoneDTO[] zones;
    public TruthPurifyPointDTO purifyPoint;
    public TruthTaskDTO[] tasks;
    public TruthPlayerDTO[] players;
    public TruthRulesDTO rules;

    public string[] log;        // 公开事件日志（不含私密碎片内容）
    public string winner;
    public string reason;
    public string purifiedBy;

    public string seed;         // 仅终局公开
    public TruthGodDTO god;     // 仅终局公开
    public TruthScoreDTO[] scores; // 仅终局公开
}

// 私有状态 (truth:privateState)
[System.Serializable]
public class TruthPrivateDTO
{
    public string mySeat;
    public string myRole;
    public string myTeam;

    public TruthShardDTO[] myShards;
    public TruthContractDTO myContract;
    public TruthSeatRefDTO guardTarget;
    public TruthGodRefDTO reincarnationOf;
    public TruthSeatRefDTO[] fellowCorrupted;

    public string guessedGodId;
    public bool burnedFalse;
    public int sacrificeCount;
    public bool blunderbussUsed;
    public string myRejoinToken;
}

// 终局广播 (truth:ended)
[System.Serializable]
public class TruthEndedDTO
{
    public string winner;
    public string reason;
    public string seed;
    public TruthGodDTO god;
    public TruthScoreDTO[] scores;
}

// 动作应答 (truth:action ack)
[System.Serializable]
public class TruthActionResultDTO
{
    public bool ok;
    public string[] events;
    public string winner;
    public string reason;
    public int phase;
}
