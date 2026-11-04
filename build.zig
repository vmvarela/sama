const std = @import("std");

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // yoga_root.zig es el ancla de paquete: @embedFile("../web/...") no puede salir de la raíz.
    const root = b.createModule(.{
        .root_source_file = b.path("yoga_root.zig"),
        .target = target,
        .optimize = optimize,
    });
    const exe = b.addExecutable(.{ .name = "sama", .root_module = root });
    b.installArtifact(exe);

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    const run_step = b.step("run", "Run the SAMA server");
    run_step.dependOn(&run_cmd.step);

    const tests = b.addTest(.{ .root_module = root });
    const test_step = b.step("test", "Run Zig unit tests");
    test_step.dependOn(&b.addRunArtifact(tests).step);
}
