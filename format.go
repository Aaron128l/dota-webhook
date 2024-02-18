package main

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

func logger(s string) {
	fmt.Printf("%s - %s\n", getTimeNowWithTZ().Format("01/02/2006 03:04:05PM-07"), s)
}

func formatDuration(seconds int) string {
	hours := seconds / 3600
	minutes := (seconds % 3600) / 60
	seconds = seconds % 60
	return fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
}

func formatTimestamp(seconds int64) string {
	t := time.Unix(seconds, 0)
	layout := "Jan 2, 2006, 3:04 PM"

	loc, err := time.LoadLocation("America/Denver")
	if err != nil {
		return t.Format(layout)
	}

	return t.UTC().In(loc).Format(layout)
}

func getTimeNowWithTZ() time.Time {
	loc, err := time.LoadLocation("America/Denver")
	if err != nil {
		return time.Now().UTC()
	}
	return time.Now().UTC().In(loc)
}

func toTitleCase(s string) string {
	gamemodeRegex := regexp.MustCompile(`^game_mode_(\w+)$`)
	matches := gamemodeRegex.FindStringSubmatch(s)

	var GameModePretty string
	if len(matches) > 1 {
		replaced := strings.Replace(matches[1], "_", " ", -1)
		GameModePretty = replaced
	} else {
		GameModePretty = "Unknown"
	}

	wordRegexp := regexp.MustCompile(`\b\w`)
	// Use the ReplaceAllStringFunc to apply a function to all matches
	return wordRegexp.ReplaceAllStringFunc(GameModePretty, func(t string) string {
		// Convert the match (which will be the first letter of a word) to uppercase
		return strings.ToUpper(t)
	})
}
