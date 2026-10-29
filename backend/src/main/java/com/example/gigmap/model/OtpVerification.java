package com.example.gigmap.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "otp_verifications")
public class OtpVerification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String mobile;
    private String email;
    private String otpCode;
    private LocalDateTime expiresAt;

    // Pending registration data
    private String name;
    private String address;
    private String password;
    private String role;
    private String profession;
    private String profilePhoto;

    public OtpVerification() {}

    public OtpVerification(String name, String mobile, String email, String address, String password, String role, String profession, String profilePhoto, String otpCode) {
        this.name = name;
        this.mobile = mobile;
        this.email = email;
        this.address = address;
        this.password = password;
        this.role = role;
        this.profession = profession;
        this.profilePhoto = profilePhoto;
        this.otpCode = otpCode;
        this.expiresAt = LocalDateTime.now().plusMinutes(10);
    }

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.expiresAt);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getMobile() { return mobile; }
    public void setMobile(String mobile) { this.mobile = mobile; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getOtpCode() { return otpCode; }
    public void setOtpCode(String otpCode) { this.otpCode = otpCode; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
    public String getProfession() { return profession; }
    public void setProfession(String profession) { this.profession = profession; }
    public String getProfilePhoto() { return profilePhoto; }
    public void setProfilePhoto(String profilePhoto) { this.profilePhoto = profilePhoto; }
}
