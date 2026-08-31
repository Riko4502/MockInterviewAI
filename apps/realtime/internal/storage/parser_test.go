package storage

import "testing"

func TestParseRevocation(t *testing.T) {
	tests := []struct {
		name          string
		payload       string
		wantUserID    string
		wantSessionID string
	}{
		{
			name:          "phase A format, user-level revoke (logout/deactivation/replay)",
			payload:       `{"instanceId":"api-host-1","data":"user-1"}`,
			wantUserID:    "user-1",
			wantSessionID: "",
		},
		{
			name:          "phase A format with sessionId (close-session, room-scoped evict)",
			payload:       `{"instanceId":"api-host-1","data":"user-1","sessionId":"sess-9"}`,
			wantUserID:    "user-1",
			wantSessionID: "sess-9",
		},
		{
			name:          "legacy format is ignored",
			payload:       `{"userId":"user-1","reason":"account_deactivated"}`,
			wantUserID:    "",
			wantSessionID: "",
		},
		{
			name:          "invalid JSON is ignored",
			payload:       `not-json`,
			wantUserID:    "",
			wantSessionID: "",
		},
		{
			name:          "empty message is ignored",
			payload:       ``,
			wantUserID:    "",
			wantSessionID: "",
		},
		{
			name:          "whitespace around data is trimmed",
			payload:       `{"instanceId":"api-host-1","data":"  user-1  "}`,
			wantUserID:    "user-1",
			wantSessionID: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			userID, sessionID := parseRevocation([]byte(tt.payload))
			if userID != tt.wantUserID {
				t.Errorf("parseRevocation(%q) userID = %q, want %q", tt.payload, userID, tt.wantUserID)
			}
			if sessionID != tt.wantSessionID {
				t.Errorf("parseRevocation(%q) sessionID = %q, want %q", tt.payload, sessionID, tt.wantSessionID)
			}
		})
	}
}
