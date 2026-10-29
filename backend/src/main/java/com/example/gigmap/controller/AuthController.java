package com.example.gigmap.controller;

import com.example.gigmap.model.OtpVerification;
import com.example.gigmap.model.User;
import com.example.gigmap.model.Worker;
import com.example.gigmap.repository.OtpRepository;
import com.example.gigmap.repository.UserRepository;
import com.example.gigmap.repository.WorkerRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.example.gigmap.service.EmailService;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(originPatterns = "*")
public class AuthController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OtpRepository otpRepository;

    @Autowired
    private WorkerRepository workerRepository;

    @Autowired
    private EmailService emailService;

    // ── 1. REGISTER: Generate OTP and hold registration pending ──────────────
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered."));
        }
        if (userRepository.existsByMobile(req.getMobile())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Mobile already registered."));
        }

        String otp = String.format("%06d", new Random().nextInt(999999));
        OtpVerification pending = new OtpVerification(
                req.getName(), req.getMobile(), req.getEmail(),
                req.getAddress(), req.getPassword(), req.getRole(), req.getProfession(), req.getProfilePhoto(), otp
        );
        otpRepository.save(pending);

        // Send OTP via email (Non-blocking or block depending on requirements. We block for simplicity here.)
        try {
            emailService.sendOtpEmail(req.getEmail(), req.getName(), otp);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to send email. Check SMTP settings."));
        }

        Map<String, String> response = new HashMap<>();
        response.put("message", "OTP sent to your email.");
        response.put("mobile", req.getMobile());
        return ResponseEntity.ok(response);
    }

    // ── 2. VERIFY OTP: Confirm OTP and create the user account ───────────────
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody OtpRequest req) {
        Optional<OtpVerification> otpOpt = otpRepository.findTopByMobileOrderByIdDesc(req.getMobile());
        if (!otpOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No OTP request found for this mobile."));
        }
        OtpVerification otp = otpOpt.get();
        if (otp.isExpired()) {
            return ResponseEntity.badRequest().body(Map.of("error", "OTP has expired. Please register again."));
        }
        if (!otp.getOtpCode().equals(req.getOtp())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Incorrect OTP. Please try again."));
        }

        // Create verified user
        User user = new User(
                otp.getName(), otp.getMobile(), otp.getEmail(),
                otp.getAddress(), otp.getPassword(), otp.getRole(), otp.getProfilePhoto()
        );
        user.setVerified(true);
        userRepository.save(user);

        if ("WORKER".equals(user.getRole())) {
            double lat = 40.7128; // default lat (New York)
            double lng = -74.0060; // default lng
            if (otp.getAddress() != null && otp.getAddress().contains(",")) {
                try {
                    String[] parts = otp.getAddress().split(",");
                    lat = Double.parseDouble(parts[0].trim());
                    lng = Double.parseDouble(parts[1].trim());
                } catch (Exception e) {}
            }

            Worker worker = new Worker(
                user.getName(),
                otp.getProfession() != null ? otp.getProfession() : "General",
                25.0, // default price per hour
                1.5,  // default price per km
                lat,
                lng,
                otp.getProfilePhoto()
            );
            worker.setUserId(user.getId());
            workerRepository.save(worker);
        }

        otpRepository.delete(otp);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "Registration successful! You can now log in.");
        response.put("userId", user.getId());
        response.put("name", user.getName());
        response.put("role", user.getRole());
        return ResponseEntity.ok(response);
    }

    // ── 3. LOGIN: via email or mobile + password ──────────────────────────────
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.getIdentifier());
        if (!userOpt.isPresent()) {
            userOpt = userRepository.findByMobile(req.getIdentifier());
        }
        if (!userOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No account found with that email or mobile."));
        }
        User user = userOpt.get();
        if (!user.getPassword().equals(req.getPassword())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Incorrect password."));
        }
        if (!user.getVerified()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Account not verified. Please complete OTP verification."));
        }

        Map<String, Object> response = new HashMap<>();
        response.put("userId", user.getId());
        response.put("name", user.getName());
        response.put("email", user.getEmail());
        response.put("mobile", user.getMobile());
        response.put("address", user.getAddress());
        response.put("role", user.getRole());
        response.put("profilePhoto", user.getProfilePhoto());
        response.put("message", "Login successful!");
        return ResponseEntity.ok(response);
    }

    // ── 4. FORGOT PASSWORD ───────────────────────────────────────────────────
    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@RequestBody LoginRequest req) {
        Optional<User> userOpt = userRepository.findByEmail(req.getIdentifier());
        if (!userOpt.isPresent()) {
            userOpt = userRepository.findByMobile(req.getIdentifier());
        }
        if (!userOpt.isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No account found."));
        }
        User user = userOpt.get();

        String otp = String.format("%06d", new Random().nextInt(999999));
        OtpVerification pending = new OtpVerification(
                null, user.getMobile(), user.getEmail(),
                null, null, "RESET", null, null, otp
        );
        otpRepository.save(pending);

        try {
            emailService.sendOtpEmail(user.getEmail(), user.getName(), otp);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body(Map.of("error", "Failed to send OTP email."));
        }

        return ResponseEntity.ok(Map.of("message", "Reset OTP sent to your email.", "mobile", user.getMobile()));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@RequestBody ResetPasswordRequest req) {
        Optional<OtpVerification> otpOpt = otpRepository.findTopByMobileOrderByIdDesc(req.getMobile());
        if (!otpOpt.isPresent() || !"RESET".equals(otpOpt.get().getRole())) {
            return ResponseEntity.badRequest().body(Map.of("error", "No reset request found."));
        }
        OtpVerification otp = otpOpt.get();
        if (otp.isExpired()) {
            return ResponseEntity.badRequest().body(Map.of("error", "OTP expired."));
        }
        if (!otp.getOtpCode().equals(req.getOtp())) {
            return ResponseEntity.badRequest().body(Map.of("error", "Incorrect OTP."));
        }

        Optional<User> userOpt = userRepository.findByMobile(req.getMobile());
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getPassword().equals(req.getNewPassword())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Password must be different from the older one."));
            }
            user.setPassword(req.getNewPassword());
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("message", "Password reset successful."));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "User not found."));
    }

    // ── Request/Response DTOs ─────────────────────────────────────────────────
    public static class RegisterRequest {
        private String name, mobile, email, address, password, role, profession, profilePhoto;
        public String getName() { return name; } public void setName(String n) { name = n; }
        public String getMobile() { return mobile; } public void setMobile(String m) { mobile = m; }
        public String getEmail() { return email; } public void setEmail(String e) { email = e; }
        public String getAddress() { return address; } public void setAddress(String a) { address = a; }
        public String getPassword() { return password; } public void setPassword(String p) { password = p; }
        public String getRole() { return role; } public void setRole(String r) { role = r; }
        public String getProfession() { return profession; } public void setProfession(String p) { profession = p; }
        public String getProfilePhoto() { return profilePhoto; } public void setProfilePhoto(String pp) { profilePhoto = pp; }
    }

    public static class OtpRequest {
        private String mobile, otp;
        public String getMobile() { return mobile; } public void setMobile(String m) { mobile = m; }
        public String getOtp() { return otp; } public void setOtp(String o) { otp = o; }
    }

    public static class LoginRequest {
        private String identifier, password;
        public String getIdentifier() { return identifier; } public void setIdentifier(String i) { identifier = i; }
        public String getPassword() { return password; } public void setPassword(String p) { password = p; }
    }

    public static class ResetPasswordRequest {
        private String mobile, otp, newPassword;
        public String getMobile() { return mobile; } public void setMobile(String m) { mobile = m; }
        public String getOtp() { return otp; } public void setOtp(String o) { otp = o; }
        public String getNewPassword() { return newPassword; } public void setNewPassword(String np) { newPassword = np; }
    }
}
