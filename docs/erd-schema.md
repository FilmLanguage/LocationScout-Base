# Location Scout — Data Schema (ERD v2)

Matches the Miro pipeline exactly. 10 entities, 14 relationships.
Direction: left-to-right (inputs → core → artifacts → outputs).

---

## SCRIPT
Source document for the entire project.
| Key | Field | Type |
|-----|-------|------|
| PK | script_id | Integer |
| NOT_NULL | title | Varchar(100) |
| NOT_NULL | content | Text |
| | version | Varchar(20) |
| | author | Varchar(100) |

## AD_LOCATION_BRIEF
Hard constraints from 1st AD. Extracted from screenplay analysis.
| Key | Field | Type | Notes |
|-----|-------|------|-------|
| PK | brief_id | Integer | |
| FK | script_id | Integer | → SCRIPT |
| NOT_NULL | location_name | Varchar(100) | |
| NOT_NULL | location_type | Varchar(10) | INT/EXT/INT-EXT |
| NOT_NULL | time_of_day | Json | ["DAY","NIGHT"] |
| | recurring | Boolean | 3+ scenes |
| | explicit_details | Json | Details from script |
| | character_actions | Json | Actions constraining space |
| | required_practicals | Json | Lights/devices needed |
| | entry_exit_points | Json | Doors, windows used |
| | props_mentioned | Json | Props in screenplay |
| | time_continuity | Text | Time flow notes |
| | production_flags | Json | Stunts, VFX, rain etc. |

## DIRECTOR_VISION
Soft interpretation from Director.
| Key | Field | Type |
|-----|-------|------|
| PK | vision_id | Integer |
| FK | script_id | Integer | → SCRIPT |
| NOT_NULL | era_and_style | Text |
| | color_palette_mood | Text |
| | spatial_philosophy | Text |
| | reference_films | Json |
| | reference_images | Json |
| | emotional_function | Text |
| | atmosphere | Text |
| | key_visual_metaphors | Json |
| | light_vision | Text |

## RESEARCH_PACK
Historical research output. Created by research cycle.
| Key | Field | Type |
|-----|-------|------|
| PK | research_id | Integer |
| FK | brief_id | Integer | → AD_LOCATION_BRIEF |
| FK | vision_id | Integer | → DIRECTOR_VISION |
| NOT_NULL | period_facts | Json |
| NOT_NULL | typical_elements | Json |
| NOT_NULL | anachronism_list | Json |
| | visual_references | Json |
| | research_status | Varchar(20) |

## LOCATION_BIBLE ⭐ (central entity)
Canonical text description. Source of truth.
| Key | Field | Type |
|-----|-------|------|
| PK | bible_id | Integer |
| FK | brief_id | Integer | → AD_LOCATION_BRIEF |
| FK | vision_id | Integer | → DIRECTOR_VISION |
| FK | research_id | Integer | → RESEARCH_PACK |
| NOT_NULL | passport | Json |
| NOT_NULL | space_description | Text |
| NOT_NULL | atmosphere | Text |
| NOT_NULL | light_base_state | Json |
| NOT_NULL | key_details | Json |
| NOT_NULL | negative_list | Json |
| | approval_status | Varchar(20) |

## FLOORPLAN_PACKAGE
Spatial layout with lighting data.
| Key | Field | Type |
|-----|-------|------|
| PK | floorplan_id | Integer |
| FK | bible_id | Integer | → LOCATION_BIBLE |
| NOT_NULL | plan_png | Varchar(200) |
| NOT_NULL | coords_json | Json |
| NOT_NULL | light_sources | Json |
| NOT_NULL | light_direction | Varchar(10) |
| NOT_NULL | color_temp_kelvin | Integer |
| | shadow_hardness | Varchar(10) |
| | fill_to_key_ratio | Float |
| | camera_feasibility | Json |
| | dimensions | Json |

## ANCHOR_IMAGE
Canonical establishing shot. All generations reference this.
| Key | Field | Type |
|-----|-------|------|
| PK | anchor_id | Integer |
| FK | bible_id | Integer | → LOCATION_BIBLE |
| NOT_NULL | image_url | Varchar(200) |
| NOT_NULL | anchor_prompt | Text |
| NOT_NULL | approval_status | Varchar(20) |
| | generation_params | Json |
| | feedback_notes | Text |

## MOOD_STATE
Delta from Bible's base state, per scene group.
| Key | Field | Type |
|-----|-------|------|
| PK | state_id | Integer |
| FK | bible_id | Integer | → LOCATION_BIBLE |
| NOT_NULL | scene_ids | Json |
| NOT_NULL | act | Integer |
| NOT_NULL | time_of_day | Varchar(20) |
| | light_direction | Varchar(10) |
| | weather | Varchar(30) |
| | color_temp_kelvin | Integer |
| | shadow_hardness | Varchar(10) |
| | light_change | Text |
| | props_change | Text |
| | atmosphere_shift | Text |
| | clutter_level | Varchar(10) |
| | window_state | Text |

## SETUP_EXTRACTION
Per-scene camera setup. Combines floorplan + mood.
| Key | Field | Type |
|-----|-------|------|
| PK | setup_id | Integer |
| FK | floorplan_id | Integer | → FLOORPLAN_PACKAGE |
| FK | state_id | Integer | → MOOD_STATE |
| NOT_NULL | scene_id | Varchar(20) |
| NOT_NULL | camera_position | Json |
| NOT_NULL | characters | Json |
| | active_practicals | Json |
| | key_props_in_frame | Json |
| | frame_composition | Text |

## ISOMETRIC_REFERENCE
3D spatial reference for Storyboard and DP.
| Key | Field | Type |
|-----|-------|------|
| PK | iso_id | Integer |
| FK | bible_id | Integer | → LOCATION_BIBLE |
| FK | floorplan_id | Integer | → FLOORPLAN_PACKAGE |
| NOT_NULL | iso_image_url | Varchar(200) |
| NOT_NULL | iso_prompt | Text |
| | style_reference | Varchar(200) |

---

## Relationships
```
SCRIPT ─1:many─► AD_LOCATION_BRIEF
SCRIPT ─1:many─► DIRECTOR_VISION
AD_LOCATION_BRIEF ─1:0..1─► RESEARCH_PACK
DIRECTOR_VISION ─1:0..1─► RESEARCH_PACK
RESEARCH_PACK ─1:1─► LOCATION_BIBLE
AD_LOCATION_BRIEF ─1:1─► LOCATION_BIBLE
DIRECTOR_VISION ─1:1─► LOCATION_BIBLE
LOCATION_BIBLE ─1:1─► FLOORPLAN_PACKAGE
LOCATION_BIBLE ─1:1─► ANCHOR_IMAGE
LOCATION_BIBLE ─1:0..many─► MOOD_STATE
FLOORPLAN_PACKAGE ─1:many─► SETUP_EXTRACTION
MOOD_STATE ─1:0..many─► SETUP_EXTRACTION
LOCATION_BIBLE ─1:1─► ISOMETRIC_REFERENCE
FLOORPLAN_PACKAGE ─1:1─► ISOMETRIC_REFERENCE
```
