package com.example.gigmap.repository;

import com.example.gigmap.model.Worker;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface WorkerRepository extends JpaRepository<Worker, Long> {
    List<Worker> findByAvailable(Boolean available);
    java.util.Optional<Worker> findByUserId(Long userId);
}
