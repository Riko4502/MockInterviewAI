package middleware

import (
	"net/url"
	"strings"
	"testing"
)

func TestSanitizeURI(t *testing.T) {
	tests := []struct {
		name     string
		rawURL   string
		expected string
	}{
		{
			name:     "clean URL without query",
			rawURL:   "/ws/sessions/room-1",
			expected: "/ws/sessions/room-1",
		},
		{
			name:     "clean URL with non-sensitive query",
			rawURL:   "/ws/sessions/room-1?role=candidate&user=Alex",
			expected: "/ws/sessions/room-1?role=candidate&user=Alex",
		},
		{
			name:     "URL with sensitive token query param",
			rawURL:   "/ws/sessions/room-1?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9&role=candidate",
			expected: "/ws/sessions/room-1?role=candidate&token=%5BREDACTED%5D",
		},
		{
			name:     "URL with access_token and secret",
			rawURL:   "/api/v1/auth?access_token=secret_123&secret=top_secret",
			expected: "/api/v1/auth?access_token=%5BREDACTED%5D&secret=%5BREDACTED%5D",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u, err := url.Parse(tt.rawURL)
			if err != nil {
				t.Fatalf("failed to parse url: %v", err)
			}

			sanitized := SanitizeURI(u)
			if !strings.Contains(sanitized, "REDACTED") && strings.Contains(tt.rawURL, "token") {
				t.Errorf("expected sensitive param to be redacted in %s", sanitized)
			}
		})
	}
}
