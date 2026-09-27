package model

// GameType represents the supported games
type GameType string

const (
	GenshinImpact   GameType = "GENSHIN_IMPACT"
	ZenlessZoneZero GameType = "ZENLESS_ZONE_ZERO"
)

// BuildTarget represents a character being built with its farming requirements
type BuildTarget struct {
	CharacterID    string         `json:"character_id" binding:"required"`
	CharacterName  string         `json:"character_name"`
	Priority       string         `json:"priority"` // HIGH, MEDIUM, LOW
	DomainDays     []int          `json:"domain_days"` // 1=Mon..7=Sun (0=everyday)
	MaterialNeeds  map[string]int `json:"material_needs"`
	ResinPerRun    int            `json:"resin_per_run"`    // 20 (domain) or 40 (boss)
	TotalRunsLeft  int            `json:"total_runs_left"`
}

// OptimizationRequest asks for a weekly farming plan
type OptimizationRequest struct {
	Game             GameType      `json:"game" binding:"required"`
	AvailableStamina int           `json:"available_stamina"` // total resin or battery for the period
	DaysToPlan       int           `json:"days_to_plan"`      // 1–7
	ActiveCharacters []BuildTarget `json:"active_characters" binding:"required"`
}

// FarmTask is one domain/boss run scheduled for a day
type FarmTask struct {
	CharacterID    string `json:"character_id"`
	CharacterName  string `json:"character_name"`
	DomainOrBoss   string `json:"domain_or_boss"`
	RunsScheduled  int    `json:"runs_scheduled"`
	StaminaCost    int    `json:"stamina_cost"`
	Priority       string `json:"priority"`
}

// DailyPlan is the recommended farming allocation for one day
type DailyPlan struct {
	DayIndex       int        `json:"day_index"` // 1=Mon..7=Sun
	DayName        string     `json:"day_name"`
	TotalStamina   int        `json:"total_stamina_allocated"`
	Tasks          []FarmTask `json:"tasks"`
}

// OptimizationResult is the full weekly plan
type OptimizationResult struct {
	Game           GameType    `json:"game"`
	TotalDays      int         `json:"total_days"`
	TotalStamina   int         `json:"total_stamina_used"`
	WeeklyPlan     []DailyPlan `json:"weekly_plan"`
	UnscheduledIDs []string    `json:"unscheduled_ids"` // characters that didn't fit
}

// ShowcaseCharacter represents one character from a public UID showcase
type ShowcaseCharacter struct {
	ID           int    `json:"id"`
	Name         string `json:"name"`
	Level        int    `json:"level"`
	Constellation int   `json:"constellation"`
	Element      string `json:"element"`
	Rarity       int    `json:"rarity"`
}

// ShowcaseResponse wraps the public showcase data
type ShowcaseResponse struct {
	UID        string              `json:"uid"`
	Characters []ShowcaseCharacter `json:"characters"`
	FetchedAt  int64               `json:"fetched_at"`
}

// APIResponse is the standard envelope for all endpoints
type APIResponse[T any] struct {
	Success bool   `json:"success"`
	Data    T      `json:"data,omitempty"`
	Error   string `json:"error,omitempty"`
}
