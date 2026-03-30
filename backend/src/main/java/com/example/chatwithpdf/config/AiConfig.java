package com.example.chatwithpdf.config;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {

    @Bean
    public ChatClient chatClient(ChatClient.Builder builder) {
        return builder.build();
    }

    @Bean
    public TokenTextSplitter tokenTextSplitter(
            @Value("${app.chunking.chunk-size:800}") int chunkSize) {
        return new TokenTextSplitter(chunkSize, 350, 5, 10000, true);
    }
}
