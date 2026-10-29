package com.example.gigmap.repository;

import com.example.gigmap.model.OtpVerification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface OtpRepository extends JpaRepository<OtpVerification, Long> {
    Optional<OtpVerification> findTopByMobileOrderByIdDesc(String mobile);
    Optional<OtpVerification> findTopByEmailOrderByIdDesc(String email);
}
