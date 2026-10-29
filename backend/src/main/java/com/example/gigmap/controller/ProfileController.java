package com.example.gigmap.controller;

import com.example.gigmap.model.OtpVerification;
import com.example.gigmap.model.User;
import com.example.gigmap.model.Worker;
import com.example.gigmap.repository.OtpRepository;
import com.example.gigmap.repository.UserRepository;
import com.example.gigmap.repository.WorkerRepository;
import com.example.gigmap.service.EmailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.io.File;

@RestController
@RequestMapping("/api/profile")
@CrossOrigin(originPatterns = "*")
public class ProfileController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private OtpRepository otpRepository;

    @Autowired
    private EmailService emailService;

    // Update Photo & Mobile
    @PutMapping("/update")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, Object> req) {
        User user = null;
        if (req.containsKey("userId") && req.get("userId") != null) {
            try {
                Long userId = Long.valueOf(req.get("userId").toString());
                user = userRepository.findById(userId).orElse(null);
            } catch (NumberFormatException ignored) {}
        }
        if (user == null && req.containsKey("mobile") && req.get("mobile") != null) {
            user = userRepository.findByMobile(req.get("mobile").toString()).orElse(null);
        }
        if (user == null && req.containsKey("email") && req.get("email") != null) {
            user = userRepository.findByEmail(req.get("email").toString()).orElse(null);
        }
        
        if (user == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "User not found or missing identifiers"));
        }
        Long userId = user.getId();

        if (req.containsKey("mobile") && req.get("mobile") != null) {
            user.setMobile(req.get("mobile").toString());
        }

        if (req.containsKey("profilePhoto") && req.get("profilePhoto") != null) {
            String newPhoto = req.get("profilePhoto").toString();
            String oldPhoto = user.getProfilePhoto();
            
            // Delete old photo if it's an internal upload and it has changed
            if (oldPhoto != null && oldPhoto.startsWith("/uploads/") && !oldPhoto.equals(newPhoto)) {
                try {
                    File fileToDelete = new File(oldPhoto.substring(1)); // removes leading '/' to get 'uploads/...'
                    if (fileToDelete.exists()) {
                        fileToDelete.delete();
                    }
                } catch (Exception e) {
                    // Log error but don't fail the request
                    System.err.println("Failed to delete old photo: " + e.getMessage());
                }
            }
            
            user.setProfilePhoto(newPhoto);
            
            // Update worker profile photo if applicable
            if ("WORKER".equals(user.getRole())) {
                Optional<Worker> wOpt = workerRepository.findByUserId(userId);
                if (wOpt.isPresent()) {
                    Worker w = wOpt.get();
                    w.setProfilePhoto(newPhoto);
                    workerRepository.save(w);
                }
            }
        }
        
        userRepository.save(user);

        return ResponseEntity.ok(user);
    }

    // Update Password
    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(@RequestBody Map<String, String> req) {
        Long userId = Long.valueOf(req.get("userId"));
        String oldPassword = req.get("oldPassword");
        String newPassword = req.get("newPassword");

        Optional<User> optUser = userRepository.findById(userId);
        if (optUser.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        
        User user = optUser.get();
        if (!user.getPassword().equals(oldPassword)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Incorrect old password"));
        }

        user.setPassword(newPassword);
        userRepository.save(user);
        return ResponseEntity.ok(Map.of("message", "Password updated successfully"));
    }

    // Request Email OTP
    @PostMapping("/email/request-otp")
    public ResponseEntity<?> requestEmailOtp(@RequestBody Map<String, String> req) {
        Long userId = Long.valueOf(req.get("userId"));
        String newEmail = req.get("newEmail");

        if (userRepository.existsByEmail(newEmail)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email is already taken"));
        }

        Optional<User> optUser = userRepository.findById(userId);
        if (optUser.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        
        User user = optUser.get();

        String otpCode = String.format("%06d", new Random().nextInt(999999));

        OtpVerification otp = new OtpVerification();
        otp.setEmail(newEmail);
        otp.setOtpCode(otpCode);
        otp.setExpiresAt(java.time.LocalDateTime.now().plusMinutes(10)); // 10 mins
        otp.setRole(user.getRole()); // just to satisfy DB, not used for login
        
        otpRepository.save(otp);
        emailService.sendOtpEmail(newEmail, user.getName(), otpCode);

        return ResponseEntity.ok(Map.of("message", "OTP sent to new email"));
    }

    // Verify Email OTP and Update
    @PutMapping("/email/verify-otp")
    public ResponseEntity<?> verifyEmailOtp(@RequestBody Map<String, String> req) {
        Long userId = Long.valueOf(req.get("userId"));
        String newEmail = req.get("newEmail");
        String otpCode = req.get("otpCode");

        OtpVerification otp = otpRepository.findTopByEmailOrderByIdDesc(newEmail).orElse(null);
        if (otp == null || !otp.getOtpCode().equals(otpCode) || otp.getExpiresAt().isBefore(java.time.LocalDateTime.now())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired OTP"));
        }

        Optional<User> optUser = userRepository.findById(userId);
        if (optUser.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        
        User user = optUser.get();
        user.setEmail(newEmail);
        userRepository.save(user);
        otpRepository.delete(otp);

        return ResponseEntity.ok(user);
    }

    // Delete Account
    @DeleteMapping("/delete")
    public ResponseEntity<?> deleteAccount(@RequestBody Map<String, String> req) {
        Long userId = Long.valueOf(req.get("userId"));
        String password = req.get("password");

        Optional<User> optUser = userRepository.findById(userId);
        if (optUser.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
        
        User user = optUser.get();
        if (!user.getPassword().equals(password)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Incorrect password. Account deletion failed."));
        }

        // Delete associated Worker if exists
        if ("WORKER".equals(user.getRole())) {
            Optional<Worker> wOpt = workerRepository.findByUserId(userId);
            wOpt.ifPresent(worker -> workerRepository.delete(worker));
        }

        // Delete User
        userRepository.delete(user);
        
        return ResponseEntity.ok(Map.of("message", "Account successfully deleted"));
    }
}
