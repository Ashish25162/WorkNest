package com.example.gigmap.controller;

import com.example.gigmap.model.Booking;
import com.example.gigmap.model.SystemConfig;
import com.example.gigmap.model.Worker;
import com.example.gigmap.repository.BookingRepository;
import com.example.gigmap.repository.SystemConfigRepository;
import com.example.gigmap.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/bookings")
@CrossOrigin(originPatterns = "*")
public class BookingController {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private SystemConfigRepository configRepository;

    private Double getActiveCommissionRate() {
        Optional<SystemConfig> configOpt = configRepository.findById("COMMISSION_PERCENTAGE");
        if (configOpt.isPresent()) {
            return configOpt.get().getConfigValue();
        }
        SystemConfig defaultConfig = new SystemConfig("COMMISSION_PERCENTAGE", 10.0);
        configRepository.save(defaultConfig);
        return 10.0;
    }

    // ── Haversine distance in km ──────────────────────────────────────────────
    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    private double calculatePrice(Double hours) {
        int minutes = (int) Math.round(hours * 60);
        if (minutes <= 30) return 250.0;
        if (minutes <= 50) return 350.0;
        if (minutes <= 60) return 400.0;
        if (minutes <= 80) return 500.0;
        if (minutes <= 120) return 650.0;
        // Overtime rate: 120 min is 650 -> ~325 per hour
        return 650.0 + ((minutes - 120) / 60.0) * 325.0;
    }

    @PostMapping
    public ResponseEntity<?> createBooking(@RequestBody BookingRequest request) {
        String startOtp = String.format("%04d", new java.util.Random().nextInt(10000));
        double serviceCost = calculatePrice(request.getInitialHours());
        
        // In the new broadcast model, travel distance isn't known until a worker accepts.
        // We'll set travelCost to 0 or calculate it when accepted. For now, 0.
        double travelCost = 0.0; 
        double totalCost = serviceCost + travelCost;

        Booking booking = new Booking(
                request.getCustomerName(),
                request.getTaskDescription(),
                request.getProfessionCategory(),
                request.getInitialHours(),
                request.getStartLat(),
                request.getStartLng(),
                request.getServiceAddress(),
                travelCost,
                serviceCost,
                totalCost,
                startOtp
        );
        
        Booking savedBooking = bookingRepository.save(booking);
        return ResponseEntity.ok(savedBooking);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Booking> getBooking(@PathVariable Long id) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();

            // ── AUTO-OVERTIME: recalculate actual hours based on elapsed time ──
            if ("ACTIVE".equals(booking.getStatus()) && booking.getStartedAt() != null) {
                double elapsedHours = Duration.between(booking.getStartedAt(), LocalDateTime.now()).toSeconds() / 3600.0;
                if (elapsedHours > booking.getInitialHours()) {
                    booking.setActualHours(elapsedHours);
                    booking.recalculateCosts(getActiveCommissionRate());
                    bookingRepository.save(booking);
                }
            }

            // Simulation removed as per request; Worker app should send real location updates via PUT /location
            return ResponseEntity.ok(booking);
        }
        return ResponseEntity.notFound().build();
    }

    // Helper to find active jobs for a worker
    @GetMapping("/active/worker/{workerId}")
    public ResponseEntity<?> getActiveWorkerBooking(@PathVariable Long workerId) {
        List<String> activeStatuses = Arrays.asList("ACCEPTED", "EN_ROUTE", "ACTIVE");
        List<Booking> bookings = bookingRepository.findByWorkerIdAndStatusIn(workerId, activeStatuses);
        if (!bookings.isEmpty()) {
            return ResponseEntity.ok(bookings.get(bookings.size() - 1));
        }
        return ResponseEntity.ok().body(null);
    }

    // Helper to find completed/cancelled jobs (History) for a worker
    @GetMapping("/worker/{workerId}/history")
    public ResponseEntity<?> getWorkerHistory(@PathVariable Long workerId) {
        List<String> statuses = Arrays.asList("COMPLETED", "CANCELLED", "REJECTED");
        List<Booking> bookings = bookingRepository.findByWorkerIdAndStatusIn(workerId, statuses);
        return ResponseEntity.ok(bookings);
    }

    // Helper to find completed/cancelled jobs (History) for a customer
    @GetMapping("/customer/{customerName}/history")
    public ResponseEntity<?> getCustomerHistory(@PathVariable String customerName) {
        List<String> statuses = Arrays.asList("COMPLETED", "CANCELLED", "REJECTED");
        List<Booking> bookings = bookingRepository.findByCustomerNameAndStatusIn(customerName, statuses);
        return ResponseEntity.ok(bookings);
    }

    // Helper to find active jobs for a customer
    @GetMapping("/active/customer/{customerName}")
    public ResponseEntity<?> getActiveCustomerBooking(@PathVariable String customerName) {
        List<String> activeStatuses = Arrays.asList("BROADCAST", "ACCEPTED", "EN_ROUTE", "ACTIVE");
        List<Booking> bookings = bookingRepository.findByCustomerNameAndStatusIn(customerName, activeStatuses);
        if (!bookings.isEmpty()) {
            return ResponseEntity.ok(bookings.get(bookings.size() - 1));
        }
        return ResponseEntity.ok().body(null);
    }

    // Fetch broadcasts for a worker or all open broadcasts for map
    @GetMapping("/broadcasts")
    public ResponseEntity<?> getBroadcasts(@RequestParam(required = false) String profession) {
        List<Booking> broadcasts;
        if (profession != null && !profession.trim().isEmpty() && !"ALL".equalsIgnoreCase(profession.trim())) {
            broadcasts = bookingRepository.findByStatusAndProfessionCategory("BROADCAST", profession.trim());
        } else {
            broadcasts = bookingRepository.findByStatus("BROADCAST");
        }
        return ResponseEntity.ok(broadcasts);
    }

    @PutMapping("/{id}/accept")
    public ResponseEntity<?> acceptBooking(@PathVariable Long id, @RequestParam Long workerId) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            if ("BROADCAST".equals(booking.getStatus())) {
                Optional<Worker> wOpt = workerRepository.findById(workerId);
                if (!wOpt.isPresent() || !wOpt.get().getAvailable()) {
                    return ResponseEntity.badRequest().body("Worker is not available to accept.");
                }
                Worker worker = wOpt.get();
                worker.setAvailable(false);
                workerRepository.save(worker);
                
                booking.setWorkerId(worker.getId());
                booking.setWorkerName(worker.getName());
                booking.setStatus("ACCEPTED");
                
                // You could calculate travel distance/cost here if required.
                bookingRepository.save(booking);
                return ResponseEntity.ok(booking);
            }
            return ResponseEntity.badRequest().body("Job already claimed or not in BROADCAST state.");
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/reject")
    public ResponseEntity<?> rejectBooking(@PathVariable Long id) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            if ("PENDING".equals(booking.getStatus())) {
                booking.setStatus("REJECTED");
                booking.setCompletedAt(LocalDateTime.now());
                bookingRepository.save(booking);

                // Free the worker immediately
                Optional<Worker> workerOpt = workerRepository.findById(booking.getWorkerId());
                if (workerOpt.isPresent()) {
                    Worker worker = workerOpt.get();
                    worker.setAvailable(true);
                    workerRepository.save(worker);
                }

                return ResponseEntity.ok(booking);
            }
            return ResponseEntity.badRequest().body("Job is not in PENDING state.");
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/start-travel")
    public ResponseEntity<?> startTravel(@PathVariable Long id) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            booking.setStatus("EN_ROUTE");
            bookingRepository.save(booking);
            return ResponseEntity.ok(booking);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/start-work")
    public ResponseEntity<?> startWork(@PathVariable Long id, @RequestParam String otp) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            if (!"EN_ROUTE".equals(booking.getStatus())) {
                return ResponseEntity.badRequest().body("Booking is not in EN_ROUTE state.");
            }
            if (!booking.getStartOtp().equals(otp)) {
                return ResponseEntity.badRequest().body("Invalid OTP. Please ask the customer for the correct 4-digit code.");
            }
            booking.setStatus("ACTIVE");
            booking.setStartedAt(LocalDateTime.now());
            bookingRepository.save(booking);
            return ResponseEntity.ok(booking);
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/extend")
    public ResponseEntity<?> extendHours(@PathVariable Long id, @RequestParam Double additionalHours) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            if ("ACTIVE".equals(booking.getStatus())) {
                booking.setActualHours(booking.getActualHours() + additionalHours);
                booking.recalculateCosts(getActiveCommissionRate());
                bookingRepository.save(booking);
                return ResponseEntity.ok(booking);
            }
            return ResponseEntity.badRequest().body("Cannot extend duration of a booking that is not currently ACTIVE.");
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<?> completeBooking(@PathVariable Long id) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            if (!"COMPLETED".equals(booking.getStatus())) {
                booking.setStatus("COMPLETED");
                booking.setCompletedAt(LocalDateTime.now());
                
                if (booking.getStartedAt() != null) {
                    double elapsedHours = Duration.between(booking.getStartedAt(), booking.getCompletedAt()).toSeconds() / 3600.0;
                    if (elapsedHours > booking.getInitialHours()) {
                        booking.setActualHours(elapsedHours);
                        double overtimeHours = elapsedHours - booking.getInitialHours();
                        double overtimeCost = overtimeHours * 325.0;
                        booking.setTotalCost(booking.getTotalCost() + overtimeCost);
                    }
                }
                booking.recalculateCosts(getActiveCommissionRate());
                bookingRepository.save(booking);

                if (booking.getWorkerId() != null) {
                    Optional<Worker> workerOpt = workerRepository.findById(booking.getWorkerId());
                    if (workerOpt.isPresent()) {
                        Worker worker = workerOpt.get();
                        worker.setAvailable(true);
                        worker.setLatitude(booking.getStartLat());
                        worker.setLongitude(booking.getStartLng());
                        workerRepository.save(worker);
                    }
                }
                return ResponseEntity.ok(booking);
            }
            return ResponseEntity.badRequest().body("Booking is already completed.");
        }
        return ResponseEntity.notFound().build();
    }

    // ── CANCEL ──────────────────────────────────────────
    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable Long id) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (!bookingOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        Booking booking = bookingOpt.get();
        if (!"BROADCAST".equals(booking.getStatus())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Cannot cancel — a worker has already accepted or the job is not in broadcast state."));
        }

        booking.setStatus("CANCELLED");
        booking.setCompletedAt(LocalDateTime.now());
        bookingRepository.save(booking);

        return ResponseEntity.ok(Map.of("message", "Booking cancelled successfully.", "booking", booking));
    }

    // ── WORKER ACTIVE/INACTIVE TOGGLE ────────────────────────────────────────
    @PutMapping("/worker/{workerId}/toggle-active")
    public ResponseEntity<?> toggleWorkerActive(@PathVariable Long workerId) {
        Optional<Worker> workerOpt = workerRepository.findById(workerId);
        if (!workerOpt.isPresent()) {
            return ResponseEntity.notFound().build();
        }
        Worker worker = workerOpt.get();
        worker.setIsActive(!worker.getIsActive());
        if (!worker.getIsActive()) {
            worker.setAvailable(false); // Offline workers aren't available
        } else {
            worker.setAvailable(true); // Going online makes available
        }
        workerRepository.save(worker);
        return ResponseEntity.ok(worker);
    }

    @PutMapping("/{id}/location")
    public ResponseEntity<?> updateWorkerLocation(@PathVariable Long id, @RequestParam Double latitude, @RequestParam Double longitude) {
        Optional<Booking> bookingOpt = bookingRepository.findById(id);
        if (bookingOpt.isPresent()) {
            Booking booking = bookingOpt.get();
            booking.setWorkerCurrentLat(latitude);
            booking.setWorkerCurrentLng(longitude);
            bookingRepository.save(booking);

            Optional<Worker> workerOpt = workerRepository.findById(booking.getWorkerId());
            if (workerOpt.isPresent()) {
                Worker worker = workerOpt.get();
                worker.setLatitude(latitude);
                worker.setLongitude(longitude);
                workerRepository.save(worker);
            }
            return ResponseEntity.ok(booking);
        }
        return ResponseEntity.notFound().build();
    }

    // Helper request body class
    public static class BookingRequest {
        private String customerName;
        private String taskDescription;
        private Long workerId;
        private String professionCategory;
        private Double initialHours;
        private Double startLat;
        private Double startLng;
        private String serviceAddress;

        public String getCustomerName() { return customerName; }
        public void setCustomerName(String customerName) { this.customerName = customerName; }
        public String getTaskDescription() { return taskDescription; }
        public void setTaskDescription(String taskDescription) { this.taskDescription = taskDescription; }
        public Long getWorkerId() { return workerId; }
        public void setWorkerId(Long workerId) { this.workerId = workerId; }
        public String getProfessionCategory() { return professionCategory; }
        public void setProfessionCategory(String professionCategory) { this.professionCategory = professionCategory; }
        public Double getInitialHours() { return initialHours; }
        public void setInitialHours(Double initialHours) { this.initialHours = initialHours; }
        public Double getStartLat() { return startLat; }
        public void setStartLat(Double startLat) { this.startLat = startLat; }
        public Double getStartLng() { return startLng; }
        public void setStartLng(Double startLng) { this.startLng = startLng; }
        public String getServiceAddress() { return serviceAddress; }
        public void setServiceAddress(String serviceAddress) { this.serviceAddress = serviceAddress; }
    }
}
