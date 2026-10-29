package com.example.gigmap.repository;

import com.example.gigmap.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
    List<ChatMessage> findByBookingIdOrderBySentAtAsc(Long bookingId);
}
