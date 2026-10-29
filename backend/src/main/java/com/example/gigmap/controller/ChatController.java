package com.example.gigmap.controller;

import com.example.gigmap.model.ChatMessage;
import com.example.gigmap.repository.ChatMessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/chat")
@CrossOrigin(originPatterns = "*")
public class ChatController {

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    // GET all messages for a booking (ordered oldest→newest)
    @GetMapping("/{bookingId}")
    public ResponseEntity<List<ChatMessage>> getMessages(@PathVariable Long bookingId) {
        List<ChatMessage> messages = chatMessageRepository.findByBookingIdOrderBySentAtAsc(bookingId);
        return ResponseEntity.ok(messages);
    }

    // POST a new message
    @PostMapping("/{bookingId}")
    public ResponseEntity<ChatMessage> sendMessage(
            @PathVariable Long bookingId,
            @RequestBody ChatMessageRequest request) {
        ChatMessage msg = new ChatMessage(
                bookingId,
                request.getSenderName(),
                request.getSenderRole(),
                request.getMessage()
        );
        chatMessageRepository.save(msg);
        return ResponseEntity.ok(msg);
    }

    public static class ChatMessageRequest {
        private String senderName, senderRole, message;
        public String getSenderName() { return senderName; } public void setSenderName(String s) { senderName = s; }
        public String getSenderRole() { return senderRole; } public void setSenderRole(String s) { senderRole = s; }
        public String getMessage() { return message; } public void setMessage(String m) { message = m; }
    }
}
