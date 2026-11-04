const std = @import("std");
const web = @import("web_assets.zig");

pub fn main() !void {
    const io = std.Io.Threaded.global_single_threaded.io();
    const port: u16 = 8080;
    var addr = std.Io.net.IpAddress{ .ip4 = std.Io.net.Ip4Address.loopback(port) };
    var server = try addr.listen(io, .{ .kernel_backlog = 16 });
    defer server.deinit(io);
    std.debug.print("Yoga Minimal en http://127.0.0.1:{d} — Ctrl-C para salir\n", .{port});
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
    serveStatic(io, &writer.interface, req.head.target, req.head.method) catch {};
}

fn serveStatic(io: std.Io, writer: *std.Io.Writer, target: []const u8, method: std.http.Method) !void {
    const path = target[0 .. (std.mem.indexOfScalar(u8, target, '?') orelse target.len)];
    const wants_asset = method == .GET or method == .HEAD;
    const asset = if (wants_asset) web.get(path) else null;
    const image = if (wants_asset and std.mem.startsWith(u8, path, "/images/")) readImage(io, path["/images/".len..]) else null;
    defer if (image) |b| std.heap.page_allocator.free(b);
    if (asset) |a| {
        try writer.print("HTTP/1.1 200 OK\r\nContent-Type: {s}\r\nContent-Length: {d}\r\n\r\n", .{ a.content_type, a.content.len });
        if (method == .GET) try writer.writeAll(a.content);
    } else if (image) |b| {
        try writer.print("HTTP/1.1 200 OK\r\nContent-Type: image/png\r\nContent-Length: {d}\r\n\r\n", .{b.len});
        if (method == .GET) try writer.writeAll(b);
    } else {
        try writer.writeAll("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\n\r\n");
    }
    try writer.flush();
}

// Lee web/images/<slug>.png del disco (no embebido). El slug solo admite [a-z0-9-],
// así que no hay separadores ni '..'. Ruta relativa: arrancar desde la raíz del repo.
fn readImage(io: std.Io, name: []const u8) ?[]u8 {
    if (!std.mem.endsWith(u8, name, ".png")) return null;
    const slug = name[0 .. name.len - ".png".len];
    if (slug.len == 0) return null;
    for (slug) |c| switch (c) {
        'a'...'z', '0'...'9', '-' => {},
        else => return null,
    };
    var buf: [256]u8 = undefined;
    const file = std.fmt.bufPrint(&buf, "web/images/{s}", .{name}) catch return null;
    return std.Io.Dir.cwd().readFileAlloc(io, file, std.heap.page_allocator, .limited(16 << 20)) catch null;
}
