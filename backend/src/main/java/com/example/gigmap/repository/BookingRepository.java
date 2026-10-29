package com.example.gigmap.repository;

import com.example.gigmap.model.Booking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByStatus(String status);
    List<Booking> findByWorkerIdAndStatusIn(Long workerId, List<String> statuses);
    List<Booking> findByStatusAndProfessionCategory(String status, String professionCategory);
    List<Booking> findByCustomerNameAndStatusIn(String customerName, List<String> statuses);
}
