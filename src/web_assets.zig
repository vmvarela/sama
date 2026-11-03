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
    if (std.mem.eql(u8, path, "/app.js"))
        return .{ .content = @embedFile("../web/app.js"), .content_type = "application/javascript" };
    if (std.mem.eql(u8, path, "/manifest.json"))
        return .{ .content = @embedFile("../web/manifest.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/sequences.json"))
        return .{ .content = @embedFile("../web/sequences.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/meditation.json"))
        return .{ .content = @embedFile("../web/meditation.json"), .content_type = "application/json" };
    if (std.mem.eql(u8, path, "/sw.js"))
        return .{ .content = @embedFile("../web/sw.js"), .content_type = "application/javascript" };
    if (std.mem.eql(u8, path, "/images/tadasana.png"))
        return .{ .content = @embedFile("../web/images/tadasana.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/uttanasana.png"))
        return .{ .content = @embedFile("../web/images/uttanasana.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/adho-mukha-svanasana.png"))
        return .{ .content = @embedFile("../web/images/adho-mukha-svanasana.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/virabhadrasana-i.png"))
        return .{ .content = @embedFile("../web/images/virabhadrasana-i.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/virabhadrasana-ii.png"))
        return .{ .content = @embedFile("../web/images/virabhadrasana-ii.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/trikonasana.png"))
        return .{ .content = @embedFile("../web/images/trikonasana.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/setu-bandhasana.png"))
        return .{ .content = @embedFile("../web/images/setu-bandhasana.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/balasana.png"))
        return .{ .content = @embedFile("../web/images/balasana.png"), .content_type = "image/png" };
    if (std.mem.eql(u8, path, "/images/meditation.png"))
        return .{ .content = @embedFile("../web/images/meditation.png"), .content_type = "image/png" };
    return null;
}