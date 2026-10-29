package com.example.gigmap.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendOtpEmail(String toEmail, String name, String otpCode) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(toEmail);
        message.setSubject("WorkNest - Your Verification Code");
        message.setText("Hello " + name + ",\n\n"
                + "Welcome to WorkNest! Your OTP verification code is: " + otpCode + "\n\n"
                + "This code will expire in 10 minutes.\n\n"
                + "Best Regards,\nThe WorkNest Team");
        
        mailSender.send(message);
    }
}
