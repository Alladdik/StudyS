namespace LTropik.Application.Interfaces;

public record RoomParticipant(string ConnectionId, Guid UserId, string DisplayName);

public interface IRoomPresenceService
{
    void Join(string roomId, string connectionId, Guid userId, string displayName);
    void Leave(string roomId, string connectionId);
    IReadOnlyList<RoomParticipant> GetParticipants(string roomId);
    int GetCount(string roomId);
    IReadOnlyDictionary<string, int> GetAllCounts();
}
