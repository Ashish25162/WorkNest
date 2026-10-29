package com.example.gigmap.controller;

import com.example.gigmap.model.Booking;
import com.example.gigmap.model.SystemConfig;
import com.example.gigmap.repository.BookingRepository;
import com.example.gigmap.repository.SystemConfigRepository;
import com.example.gigmap.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin")
@CrossOrigin(originPatterns = "*")
public class AdminController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private SystemConfigRepository configRepository;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        List<Booking> allBookings = bookingRepository.findAll();
        long workerCount = workerRepository.count();

        double totalRevenue = 0.0;
        double totalCommission = 0.0;
        long completedBookings = 0;
        long activeBookings = 0;

        for (Booking booking : allBookings) {
            if ("COMPLETED".equals(booking.getStatus())) {
                totalRevenue += booking.getTotalCost();
                totalCommission += booking.getCommissionAmount();
                completedBookings++;
            } else if (!"CANCELLED".equals(booking.getStatus())) {
                activeBookings++;
            }
        }

        // Get active commission percentage setting
        Optional<SystemConfig> configOpt = configRepository.findById("COMMISSION_PERCENTAGE");
        double commissionPercent = configOpt.map(SystemConfig::getConfigValue).orElse(10.0);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalRevenue", totalRevenue);
        stats.put("totalCommission", totalCommission);
        stats.put("completedBookings", completedBookings);
        stats.put("activeBookings", activeBookings);
        stats.put("totalWorkers", workerCount);
        stats.put("commissionPercentage", commissionPercent);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/transactions")
    public List<Booking> getTransactions() {
        return bookingRepository.findAll();
    }

    @PutMapping("/commission")
    public ResponseEntity<?> updateCommissionPercentage(@RequestParam Double percentage) {
        if (percentage < 0 || percentage > 100) {
            return ResponseEntity.badRequest().body("Percentage must be between 0 and 100");
        }
        SystemConfig config = new SystemConfig("COMMISSION_PERCENTAGE", percentage);
        SystemConfig savedConfig = configRepository.save(config);
        return ResponseEntity.ok(savedConfig);
    }
}
