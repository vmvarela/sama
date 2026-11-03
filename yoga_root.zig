const std = @import("std");

pub fn main() !void {
    try @import("src/main.zig").main();
}