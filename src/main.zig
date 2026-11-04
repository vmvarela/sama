const std = @import("std");
const web = @import("web_assets.zig");

pub fn main() !void {
    const io = std.Io.Threaded.global_single_threaded.io();
    const port: u16 = 8080;
    var addr = std.Io.net.IpAddress{ .ip4 = std.Io.net.Ip4Address.loopback(port) };
    var server = try addr.listen(io, .{ .kernel_backlog = 16 });
    defer server.deinit(io);
    std.debug.print("SAMA en http://127.0.0.1:{d} — Ctrl-C para salir\n", .{port});
    while (true) {
        const stream = server.accept(io) catch continue;
        const t = std.Thread.spawn(.{}, handleConnection, .{ io, stream }) catch {
            stream.close(io);
            continue;
        };
        t.detach();
    }
}

fn handleConnection(io: std.Io, stream: std.Io.net.Stream) void {
    defer stream.close(io);
    var in_buf: [65536]u8 = undefined;
    var out_buf: [65536]u8 = undefined;
    var reader = stream.reader(io, &in_buf);
    var writer = stream.writer(io, &out_buf);
    var srv = std.http.Server.init(&reader.interface, &writer.interface);
    const req = srv.receiveHead() catch return;
    serveStatic(&writer.interface, req.head.target, req.head.method) catch {};
}

// Solo sirve la tabla embebida (web_assets.zig): sin acceso a disco en ejecución.
fn serveStatic(writer: *std.Io.Writer, target: []const u8, method: std.http.Method) !void {
    const path = target[0 .. (std.mem.indexOfScalar(u8, target, '?') orelse target.len)];
    const wants_body = method == .GET;
    const asset = if (method == .GET or method == .HEAD) web.get(path) else null;
    if (asset) |a| {
        try writer.print("HTTP/1.1 200 OK\r\nContent-Type: {s}\r\nContent-Length: {d}\r\n\r\n", .{ a.content_type, a.content.len });
        if (wants_body) try writer.writeAll(a.content);
    } else {
        try writer.writeAll("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
    }
    try writer.flush();
}

test "tabla embebida: ruta exacta, alias / y sin traversal" {
    try std.testing.expect(web.get("/") != null);
    try std.testing.expect(web.get("/index.html") != null);
    try std.testing.expect(web.get("/images/balasana.png") != null);
    try std.testing.expect(web.get("/images/../index.html") == null);
    try std.testing.expect(web.get("/images/balasana.png/") == null);
    try std.testing.expect(web.get("/nope.png") == null);
}
