using System.Collections.Concurrent;
using LTropik.Application.Interfaces;

namespace LTropik.Infrastructure.Services;

public class RoomPresenceService : IRoomPresenceService
{
    private readonly ConcurrentDictionary<string, ConcurrentDictionary<string, RoomParticipant>> _rooms = new();

    public void Join(string roomId, string connectionId, Guid userId, string displayName)
    {
        var room = _rooms.GetOrAdd(roomId, _ => new ConcurrentDictionary<string, RoomParticipant>());
        room[connectionId] = new RoomParticipant(connectionId, userId, displayName);
    }

    public void Leave(string roomId, string connectionId)
    {
        if (_rooms.TryGetValue(roomId, out var room))
        {
            room.TryRemove(connectionId, out _);
            if (room.IsEmpty) _rooms.TryRemove(roomId, out _);
        }
    }

    public IReadOnlyList<RoomParticipant> GetParticipants(string roomId) =>
        _rooms.TryGetValue(roomId, out var room)
            ? room.Values.ToList()
            : [];

    public int GetCount(string roomId) =>
        _rooms.TryGetValue(roomId, out var room) ? room.Count : 0;

    public IReadOnlyDictionary<string, int> GetAllCounts() =>
        _rooms.ToDictionary(kvp => kvp.Key, kvp => kvp.Value.Count);
}
