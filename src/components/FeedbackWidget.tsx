import React, { useState } from "react";
import { MessageCircle, X, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const reset = () => {
    setRating(0);
    setHovered(0);
    setComment("");
    setStatus("idle");
  };

  const handleOpen = () => {
    reset();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    reset();
  };

  const handleSubmit = async () => {
    if (!rating) return;
    setStatus("submitting");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData?.user?.id ?? null;
      const { error } = await supabase.from("feedback").insert({
        user_id,
        rating,
        comment: comment.trim() || null,
        page: window.location.pathname,
      });
      if (error) throw error;
      setStatus("success");
      setTimeout(() => {
        setOpen(false);
        reset();
      }, 2000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        aria-label="Give feedback"
        style={{
          position: "fixed",
          bottom: "24px",
          left: "24px",
          zIndex: 50,
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          backgroundColor: "#1A110A",
          border: "1px solid #412D15",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "#D4A045")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "#412D15")}
      >
        <MessageCircle size={20} color="#D4A045" />
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: "84px",
            left: "24px",
            zIndex: 50,
            width: "300px",
            backgroundColor: "#1A110A",
            border: "1px solid #412D15",
            borderRadius: "12px",
            padding: "20px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {status === "success" ? (
            <p style={{ color: "#E1DCC9", fontSize: "14px", textAlign: "center", margin: "12px 0" }}>
              Thanks for the feedback.
            </p>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                <p style={{ color: "#E1DCC9", fontSize: "14px", fontWeight: 600, margin: 0, lineHeight: "1.3" }}>
                  How is Metricore working for you?
                </p>
                <button
                  onClick={handleClose}
                  aria-label="Close"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: "0 0 0 8px", color: "#8a7060", flexShrink: 0 }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Stars */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                {[1, 2, 3, 4, 5].map(n => {
                  const active = n <= (hovered || rating);
                  return (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHovered(n)}
                      onMouseLeave={() => setHovered(0)}
                      aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                    >
                      <Star
                        size={24}
                        color={active ? "#D4A045" : "#8a7060"}
                        fill={active ? "#D4A045" : "none"}
                        strokeWidth={1.5}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Textarea */}
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Anything we can improve?"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "#0B0704",
                  border: "1px solid #412D15",
                  borderRadius: "6px",
                  color: "#E1DCC9",
                  fontSize: "13px",
                  padding: "8px 10px",
                  resize: "vertical",
                  outline: "none",
                  marginBottom: "14px",
                  fontFamily: "inherit",
                }}
                onFocus={e => (e.currentTarget.style.borderColor = "#D4A045")}
                onBlur={e => (e.currentTarget.style.borderColor = "#412D15")}
              />

              {/* Error */}
              {status === "error" && (
                <p style={{ color: "#e07060", fontSize: "12px", marginBottom: "10px" }}>
                  Something went wrong.
                </p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={handleSubmit}
                  disabled={!rating || status === "submitting"}
                  style={{
                    flex: 1,
                    backgroundColor: rating ? "#D4A045" : "#412D15",
                    color: rating ? "#0B0704" : "#8a7060",
                    border: "none",
                    borderRadius: "6px",
                    padding: "8px 0",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: rating ? "pointer" : "not-allowed",
                    transition: "background-color 0.15s",
                  }}
                >
                  {status === "submitting" ? "Sending..." : "Send feedback"}
                </button>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1,
                    backgroundColor: "transparent",
                    color: "#8a7060",
                    border: "1px solid #412D15",
                    borderRadius: "6px",
                    padding: "8px 0",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
