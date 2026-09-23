# pixel_camera.gd - a Camera2D that follows a target on whole pixels (no smoothing).
# Put it below the target in the scene tree so it runs after the target has moved.
extends Camera2D

@export var target: Node2D

func _ready() -> void:
	position_smoothing_enabled = false
	process_callback = Camera2D.CAMERA2D_PROCESS_PHYSICS

func _physics_process(_delta: float) -> void:
	global_position = target.global_position.round()
