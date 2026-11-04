//! Embedded web frontend for Yoga Minimal, served by main.zig's HTTP arm.
//! @embedFile resolves relative to this file; this module lives in src/,
//! so "../../web" points at the repo root web/ directory.

const std = @import("std");

pub const Asset = struct {
    content: []const u8,
    content_type: []const u8,
};

pub fn get(path: []const u8) ?Asset {
    if (std.mem.eql(u8, path, "/") or std.mem.eql(u8, path, "/index.html"))
        return .{ .content = @embedFile("../web/index.html"), .content_type = "text/html; charset=utf-8" };
    if (std.mem.eql(u8, path, "/style.css"))
        return .{ .content = @embedFile("../web/style.css"), .content_type = "text/css; charset=utf-8" };
    if (std.mem.eql(u8, path, "/tracker.css"))
        return .{ .content = @embedFile("../web/tracker.css"), .content_type = "text/css; charset=utf-8" };
    if (std.mem.eql(u8, path, "/app.js"))
        return .{ .content = @embedFile("../web/app.js"), .content_type = "application/javascript" };
    if (std.mem.eql(u8, path, "/tracker.js"))
        return .{ .content = @embedFile("../web/tracker.js"), .content_type = "application/javascript" };
    if (std.mem.eql(u8, path, "/day-player.js"))
        return .{ .content = @embedFile("../web/day-player.js"), .content_type = "application/javascript" };
    if (std.mem.eql(u8, path, "/manifest.json"))
        return .{ .content = @embedFile("../web/manifest.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/sequences.json"))
        return .{ .content = @embedFile("../web/sequences.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/meditation.json"))
        return .{ .content = @embedFile("../web/meditation.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/week-data.json"))
        return .{ .content = @embedFile("../web/week-data.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/images-map.json"))
        return .{ .content = @embedFile("../web/images-map.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/sw.js"))
        return .{ .content = @embedFile("../web/sw.js"), .content_type = "application/javascript" };
    return null;
}
